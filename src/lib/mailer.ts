import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "./env";

let transporter: nodemailer.Transporter | undefined;

// Pooled SMTP connections (Resend SMTP, Google Workspace relay, etc.).
function mailer() {
  if (!transporter) {
    const e = env();
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(options: Omit<Mail.Options, "from">): Promise<void> {
  await mailer().sendMail({ from: env().MAIL_FROM, ...options });
}

export function closeMailer(): void {
  transporter?.close();
}
