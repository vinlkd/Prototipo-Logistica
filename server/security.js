import {randomBytes, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {SignJWT, jwtVerify} from 'jose';

const derive = promisify(scrypt);
const parameters = {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024};
let active = 0;
const waiting = [];
async function limitedDerive(password, salt) {
  if (active >= 2) {
    if (waiting.length >= 8) throw Object.assign(new Error('Aguarde um instante e tente novamente.'), {status: 503});
    await new Promise(resolve => waiting.push(resolve));
  } else active++;
  try { return await derive(password, salt, 64, parameters); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await limitedDerive(password, salt);
  return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, salt, hex] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || n !== '131072' || r !== '8' || p !== '1' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hex ?? '')) return false;
  const actual = await limitedDerive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}

export const digest = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export async function signJwt(claims, secret) {
  return new SignJWT(claims).setProtectedHeader({alg: 'HS256', typ: 'JWT'}).sign(Buffer.from(secret));
}

export async function verifyJwt(value, secret, now) {
  try {
    if (typeof value !== 'string' || value.length > 2048) return null;
    const {payload: claims} = await jwtVerify(value, Buffer.from(secret), {
      algorithms: ['HS256'], issuer: 'logistica-auth', audience: 'logistica', typ: 'JWT',
      requiredClaims: ['sub', 'jti', 'ver', 'iat', 'exp'], currentDate: new Date(now * 1000),
    });
    if (typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(claims.jti ?? '') || !Number.isInteger(claims.ver)) return null;
    if (!Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) || claims.iat > now + 30 || claims.exp <= claims.iat) return null;
    return claims;
  } catch { return null; }
}

export function validateEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) ? email : null;
}
export const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128;

export function validateEnrollment(value) {
  if (typeof value !== 'string') return null;
  const enrollment = value.trim();
  return /^[A-Za-z0-9-]{3,30}$/.test(enrollment) ? enrollment : null;
}
