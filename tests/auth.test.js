import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { createAuthServer } from "../server/app.js";
import {
  hashPassword,
  validPassword,
  validateEnrollment,
} from "../server/security.js";

const origin = "http://127.0.0.1:5173";
const password = "Minha senha de teste 2026!";
const account = {
  name: "Aluno SENAI",
  email: "aluno@example.com",
  enrollment: "000123-SENAI",
  password,
};
const authHeaders = {
  Origin: origin,
  "X-Requested-With": "Logistica",
  "Content-Type": "application/json",
};

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "logistica-auth-"));
  const messages = [],
    errors = [];
  let clock = Date.now();
  const config = {
    env: {},
    dataDir,
    clock: () => clock,
    mailer: {
      async send(message) {
        messages.push(message);
      },
      close() {},
    },
    logger: {
      error(message) {
        errors.push(message);
      },
    },
    ...options,
  };
  if (options.setup) await options.setup(dataDir);
  let app = await createAuthServer(config);
  async function listen() {
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
  }
  await listen();
  const request = async (route, body, extra = {}) => {
    const {
      headers = {},
      cookie,
      method = body === undefined ? "GET" : "POST",
      raw,
      ...rest
    } = extra;
    const response = await fetch(
      `http://127.0.0.1:${app.server.address().port}/api/auth/${route}`,
      {
        method,
        headers: {
          ...authHeaders,
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body === undefined && raw === undefined
          ? {}
          : { body: raw ?? JSON.stringify(body) }),
        ...rest,
      },
    );
    const result = await response.json();
    return {
      status: response.status,
      body: result,
      headers: response.headers,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const readDb = (fn) => {
    const db = new DatabaseSync(join(dataDir, "auth.sqlite"));
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };
  t.after(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    request,
    messages,
    errors,
    dataDir,
    readDb,
    advance(seconds) {
      clock += seconds * 1000;
    },
    async restart() {
      await app.close();
      app = await createAuthServer(config);
      await listen();
    },
  };
}

test("cadastro autentica por cookie HttpOnly e guarda somente hash da senha", async (t) => {
  const f = await fixture(t);
  const created = await f.request("register", {
    ...account,
    email: " ALUNO@example.com ",
  });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body), ["user"]);
  assert.deepEqual(Object.keys(created.body.user).sort(), [
    "email",
    "enrollment",
    "id",
    "name",
  ]);
  assert.equal(created.body.user.email, account.email);
  for (const flag of [
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api",
    "Max-Age=28800",
  ])
    assert.ok(created.headers.get("set-cookie").includes(flag));
  assert.equal(created.headers.get("cache-control"), "no-store");
  const me = await f.request("me", undefined, { cookie: created.cookie });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.user, created.body.user);
  assert.equal((await f.request("me")).status, 401);
  const stored = f.readDb((db) => db.prepare("SELECT * FROM users").get());
  assert.match(stored.password_hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(JSON.stringify(stored).includes(password), false);
  const duplicate = await f.request("register", account);
  assert.equal(duplicate.status, 409);
});

test("login verifica senha e logout revoga a sessão até com cookie reapresentado", async (t) => {
  const f = await fixture(t);
  const first = await f.request("register", account);
  assert.equal(
    (
      await f.request("login", {
        email: account.email,
        password: "senha incorreta",
      })
    ).status,
    401,
  );
  assert.equal(
    (await f.request("login", { email: "ausente@example.com", password }))
      .status,
    401,
  );
  const login = await f.request("login", { email: account.email, password });
  assert.equal(login.status, 200);
  const logout = await f.request("logout", {}, { cookie: login.cookie });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get("set-cookie").includes("Max-Age=0"));
  assert.equal(
    (await f.request("me", undefined, { cookie: login.cookie })).status,
    401,
  );
  assert.equal(
    (await f.request("me", undefined, { cookie: first.cookie })).status,
    200,
  );
});

test("JWT adulterado, sem assinatura, duplicado ou expirado é rejeitado", async (t) => {
  const f = await fixture(t),
    created = await f.request("register", account);
  const value = created.cookie.split("=")[1],
    parts = value.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url"));
  const bad = `${parts[0]}.${Buffer.from(JSON.stringify({ ...payload, sub: "outro" })).toString("base64url")}.${parts[2]}`;
  assert.equal(
    (await f.request("me", undefined, { cookie: `logistica_session=${bad}` }))
      .status,
    401,
  );
  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${parts[1]}.`;
  assert.equal(
    (
      await f.request("me", undefined, {
        cookie: `logistica_session=${unsigned}`,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request("me", undefined, {
        cookie: `${created.cookie}; ${created.cookie}`,
      })
    ).status,
    401,
  );
  f.advance(8 * 60 * 60 + 1);
  assert.equal(
    (await f.request("me", undefined, { cookie: created.cookie })).status,
    401,
  );
});

test("mutações bloqueiam origem externa, Origin ausente, ausência de header e fetch cross-site", async (t) => {
  const f = await fixture(t);
  for (const headers of [
    { Origin: "https://atacante.example" },
    { Origin: "" },
    { "X-Requested-With": "" },
    { "Sec-Fetch-Site": "cross-site" },
  ])
    assert.equal(
      (await f.request("register", account, { headers })).status,
      403,
    );
  assert.equal(
    f.readDb((db) => db.prepare("SELECT count(*) AS n FROM users").get().n),
    0,
  );
});

test("recuperação não enumera contas nem devolve token, e só envia um pedido por minuto", async (t) => {
  const f = await fixture(t);
  await f.request("register", account);
  const known = await f.request("forgot-password", { email: account.email });
  const unknown = await f.request("forgot-password", {
    email: "ausente@example.com",
  });
  const malformed = await f.request("forgot-password", { email: "inválido" });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);
  assert.deepEqual(known.body, malformed.body);
  assert.deepEqual(Object.keys(known.body), ["message"]);
  await f.request("forgot-password", { email: account.email });
  assert.equal(f.messages.length, 1);
  const link = new URL(f.messages[0].url);
  assert.equal(link.origin, origin);
  const rawToken = link.searchParams.get("resetToken");
  assert.equal(rawToken.length, 43);
  const stored = f.readDb((db) =>
    db.prepare("SELECT * FROM password_resets").get(),
  );
  assert.equal(stored.token_hash.length, 64);
  assert.notEqual(stored.token_hash, rawToken);
  assert.equal(JSON.stringify(known.body).includes(rawToken), false);
});

test("redefinir a senha consome token, revoga todas as sessões e requer novo login", async (t) => {
  const f = await fixture(t),
    created = await f.request("register", account);
  const second = await f.request("login", { email: account.email, password });
  await f.request("forgot-password", { email: account.email });
  const token = new URL(f.messages[0].url).searchParams.get("resetToken");
  const nextPassword = "Nova senha muito boa 2027!";
  const reset = await f.request("reset-password", {
    token,
    password: nextPassword,
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.user, undefined);
  assert.equal(
    (await f.request("me", undefined, { cookie: created.cookie })).status,
    401,
  );
  assert.equal(
    (await f.request("me", undefined, { cookie: second.cookie })).status,
    401,
  );
  assert.equal(
    (await f.request("reset-password", { token, password: nextPassword }))
      .status,
    400,
  );
  assert.equal(
    (await f.request("login", { email: account.email, password })).status,
    401,
  );
  assert.equal(
    (await f.request("login", { email: account.email, password: nextPassword }))
      .status,
    200,
  );
});

test("token expira em 20 minutos e pedido posterior invalida o link anterior", async (t) => {
  const f = await fixture(t);
  await f.request("register", account);
  await f.request("forgot-password", { email: account.email });
  const first = new URL(f.messages[0].url).searchParams.get("resetToken");
  f.advance(61);
  await f.request("forgot-password", { email: account.email });
  const second = new URL(f.messages[1].url).searchParams.get("resetToken");
  assert.notEqual(first, second);
  assert.equal(
    (await f.request("reset-password", { token: first, password })).status,
    400,
  );
  f.advance(20 * 60);
  assert.equal(
    (await f.request("reset-password", { token: second, password })).status,
    400,
  );
});

test("duas requisições concorrentes não conseguem consumir o mesmo token", async (t) => {
  const f = await fixture(t);
  await f.request("register", account);
  await f.request("forgot-password", { email: account.email });
  const token = new URL(f.messages[0].url).searchParams.get("resetToken");
  const results = await Promise.all([
    f.request("reset-password", {
      token,
      password: "Senha concorrente numero um!",
    }),
    f.request("reset-password", {
      token,
      password: "Senha concorrente numero dois!",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});

test("limite por e-mail bloqueia brute force e devolve Retry-After", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await f.request("login", { email: account.email, password })).status,
      401,
    );
  const blocked = await f.request("login", { email: account.email, password });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  f.advance(15 * 60 + 1);
  assert.equal(
    (await f.request("login", { email: account.email, password })).status,
    401,
  );
});

test("conta, chave e sessão sobrevivem a reinício do servidor", async (t) => {
  const f = await fixture(t),
    created = await f.request("register", account);
  await f.restart();
  assert.equal(
    (await f.request("me", undefined, { cookie: created.cookie })).status,
    200,
  );
  assert.equal(
    (await f.request("login", { email: account.email, password })).status,
    200,
  );
});

test("valida dados, limites do corpo, JSON inválido e entradas hostis", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request("register", { ...account, password: "curta" })).status,
    400,
  );
  assert.equal(
    (
      await f.request("register", {
        ...account,
        email: "user@example.com\r\nBcc:intruso@example.com",
      })
    ).status,
    400,
  );
  assert.equal(
    (await f.request("register", { ...account, name: "\u0001" })).status,
    400,
  );
  assert.equal((await f.request("login", {}, { raw: "{" })).status, 400);
  assert.equal(
    (await f.request("login", {}, { raw: "x".repeat(9000) })).status,
    413,
  );
  assert.equal(
    (
      await f.request(
        "login",
        {},
        { headers: { "Content-Type": "text/plain" } },
      )
    ).status,
    415,
  );
  assert.equal(
    (await f.request("login", { email: "' OR 1=1 --", password })).status,
    401,
  );
  assert.equal(f.errors.length, 0);
});

test("caixa de desenvolvimento grava e-mail privado sem endpoint de leitura", async (t) => {
  const f = await fixture(t, { mailer: undefined });
  await f.request("register", account);
  const response = await f.request("forgot-password", { email: account.email });
  assert.equal(response.status, 200);
  assert.equal(response.body.token, undefined);
  const files = await readdir(join(f.dataDir, "mail"));
  assert.equal(files.length, 1);
  assert.match(
    await readFile(join(f.dataDir, "mail", files[0]), "utf8"),
    /resetToken=[A-Za-z0-9_-]{43}/,
  );
  assert.equal((await f.request("../../.local/auth/mail")).status, 404);
});

test("produção recusa HTTP, ausência de segredo e ausência de SMTP", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "logistica-config-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(
    createAuthServer({ dataDir: dir, env: { NODE_ENV: "production" } }),
    /HTTPS/,
  );
  await assert.rejects(
    createAuthServer({
      dataDir: dir,
      env: { NODE_ENV: "production", APP_ORIGIN: "https://logistica.example" },
    }),
    /AUTH_JWT_SECRET/,
  );
  await assert.rejects(
    createAuthServer({
      dataDir: dir,
      env: {
        NODE_ENV: "production",
        APP_ORIGIN: "https://logistica.example",
        AUTH_JWT_SECRET: "s".repeat(64),
      },
    }),
    /SMTP/,
  );
});

test("falha de envio mantém resposta genérica e remove token não entregue", async (t) => {
  const f = await fixture(t, {
    mailer: {
      async send() {
        throw new Error("SMTP indisponível");
      },
    },
  });
  await f.request("register", account);
  const response = await f.request("forgot-password", { email: account.email });
  assert.equal(response.status, 200);
  assert.equal(f.errors.length, 1);
  assert.equal(
    f.readDb(
      (db) => db.prepare("SELECT count(*) AS n FROM password_resets").get().n,
    ),
    0,
  );
});

test("valida matrícula como texto e aceita exatamente 8 a 128 caracteres de senha", () => {
  for (const value of [
    undefined,
    null,
    123,
    "",
    "12",
    "a".repeat(31),
    "123 456",
    "ABC/123",
    "á123",
    "AB_12",
  ])
    assert.equal(validateEnrollment(value), null);
  assert.equal(validateEnrollment("  000123-AbC  "), "000123-AbC");
  assert.equal(validateEnrollment("A".repeat(30)), "A".repeat(30));
  for (const value of [
    undefined,
    null,
    12345678,
    "x".repeat(7),
    "x".repeat(129),
  ])
    assert.equal(validPassword(value), false);
  assert.equal(validPassword("x".repeat(8)), true);
  assert.equal(validPassword("x".repeat(128)), true);
});

test("cadastro exige matrícula, preserva zeros e bloqueia matrícula duplicada sem distinguir caixa", async (t) => {
  const f = await fixture(t);
  const { enrollment, ...withoutEnrollment } = account;
  assert.equal((await f.request("register", withoutEnrollment)).status, 400);
  assert.equal(
    (await f.request("register", { ...account, enrollment: 123456 })).status,
    400,
  );
  const created = await f.request("register", {
    ...account,
    enrollment: "  000123-AbC  ",
    password: "Oito123!",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.enrollment, "000123-AbC");
  const duplicate = await f.request("register", {
    ...account,
    email: "outro@example.com",
    enrollment: "000123-aBc",
  });
  assert.equal(duplicate.status, 409);
  const me = await f.request("me", undefined, { cookie: created.cookie });
  assert.equal(me.body.user.enrollment, "000123-AbC");
  const login = await f.request("login", {
    email: account.email,
    password: "Oito123!",
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.enrollment, "000123-AbC");
  assert.equal(
    f.readDb((db) => db.prepare("SELECT count(*) AS n FROM users").get().n),
    1,
  );
});

test("senha de 8 caracteres funciona também na redefinição; 7 não consome o token", async (t) => {
  const f = await fixture(t);
  await f.request("register", account);
  await f.request("forgot-password", { email: account.email });
  const token = new URL(f.messages[0].url).searchParams.get("resetToken");
  assert.equal(
    (await f.request("reset-password", { token, password: "1234567" })).status,
    400,
  );
  assert.equal(
    (await f.request("reset-password", { token, password: "Nova123!" })).status,
    200,
  );
  assert.equal(
    (await f.request("login", { email: account.email, password: "Nova123!" }))
      .status,
    200,
  );
});

test("migração aditiva preserva conta e sessão legadas com matrícula nula e suporta reinício", async (t) => {
  const f = await fixture(t, {
    async setup(dataDir) {
      const db = new DatabaseSync(join(dataDir, "auth.sqlite"));
      try {
        db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);`);
        db.prepare(
          "INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)",
        ).run(
          "legacy-user",
          "Aluno anterior",
          account.email,
          await hashPassword(password),
          Math.floor(Date.now() / 1000),
        );
      } finally {
        db.close();
      }
    },
  });
  const login = await f.request("login", { email: account.email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.enrollment, null);
  assert.equal(login.body.user.id, "legacy-user");
  await f.restart();
  const me = await f.request("me", undefined, { cookie: login.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.enrollment, null);
  const created = await f.request("register", {
    ...account,
    email: "novo@example.com",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.enrollment, account.enrollment);
  assert.equal(
    f.readDb((db) => db.prepare("SELECT count(*) AS n FROM users").get().n),
    2,
  );
});

test("cadastro limita a 5 tentativas, retorna 429/Retry-After e libera após a janela", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await f.request("register", { ...account, password: "curta" })).status,
      400,
    );
  const blocked = await f.request("register", account);
  assert.equal(blocked.status, 429);
  assert.equal(Number(blocked.headers.get("retry-after")), 900);
  assert.equal(
    f.readDb((db) => db.prepare("SELECT count(*) AS n FROM users").get().n),
    0,
  );
  f.advance(899);
  const stillBlocked = await f.request("register", account);
  assert.equal(stillBlocked.status, 429);
  assert.equal(Number(stillBlocked.headers.get("retry-after")), 1);
  f.advance(2);
  assert.equal((await f.request("register", account)).status, 201);
});

test("recuperação limita a 10 pedidos e mantém Retry-After sem expor existência da conta", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await f.request("forgot-password", { email: account.email })).status,
      200,
    );
  const blocked = await f.request("forgot-password", {
    email: "outro@example.com",
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal(f.messages.length, 0);
  f.advance(901);
  assert.equal(
    (await f.request("forgot-password", { email: account.email })).status,
    200,
  );
});

test("redefinição limita a 12 tentativas inválidas e libera após a janela", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 12; i++)
    assert.equal(
      (await f.request("reset-password", { token: "inválido", password }))
        .status,
      400,
    );
  const blocked = await f.request("reset-password", {
    token: "inválido",
    password,
  });
  assert.equal(blocked.status, 429);
  assert.equal(Number(blocked.headers.get("retry-after")), 900);
  f.advance(901);
  assert.equal(
    (await f.request("reset-password", { token: "inválido", password })).status,
    400,
  );
});
