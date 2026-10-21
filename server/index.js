import {createAuthServer} from './app.js';

try {
  const app = await createAuthServer();
  const host = process.env.AUTH_HOST || '127.0.0.1';
  const port = Number(process.env.AUTH_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('AUTH_PORT inválida.');
  app.server.listen(port, host, () => {
    console.log(`Autenticação disponível em http://${host}:${port}/api/auth`);
    if (!process.env.SMTP_HOST) console.log('E-mails de desenvolvimento são gravados no diretório privado de dados, na subpasta mail.');
  });
  app.server.on('error', error => {console.error(`Não foi possível iniciar a autenticação: ${error.code || 'erro do servidor'}`); process.exitCode = 1;});
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (closing) return; closing = true;
    await app.close(); process.exitCode = 0;
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
