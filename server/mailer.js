import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export async function createMailer({ env, dataDir, production }) {
  const from = env.SMTP_FROM || "Logistica SENAI <nao-responda@localhost>";
  if (/[\r\n]/.test(from)) throw new Error("SMTP_FROM inválido.");
  if (env.SMTP_HOST) {
    const { default: nodemailer } = await import("nodemailer");
    const port = Number(env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("SMTP_PORT inválido.");
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    return {
      send: async ({ email, url }) =>
        transport.sendMail({
          from,
          to: email,
          subject: "Redefinir sua senha — Logística SENAI",
          text: `Recebemos um pedido para redefinir sua senha.\n\nAbra este link em até 20 minutos:\n${url}\n\nO link funciona uma única vez. Se você não pediu a alteração, ignore esta mensagem.`,
        }),
      close: () => transport.close(),
    };
  }
  if (production)
    throw new Error(
      "Configure SMTP_HOST e SMTP_FROM para a recuperação de senha em produção.",
    );
  const outbox = join(dataDir, "mail");
  await mkdir(outbox, { recursive: true, mode: 0o700 });
  return {
    send: async ({ email, url }) => {
      const message = `To: ${email}\r\nSubject: Redefinir sua senha - Logistica SENAI\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nAbra em ate 20 minutos (uso unico):\r\n${url}\r\n`;
      await writeFile(
        join(outbox, `${Date.now()}-${randomUUID()}.eml`),
        message,
        { mode: 0o600, flag: "wx" },
      );
    },
    close() {},
  };
}
