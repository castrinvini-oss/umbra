import nodemailer from "nodemailer";
import { db } from "../db";
import { env } from "../env";
import { getSiteConfig } from "../services/settings.service";
import { renderEmail, type EmailTemplateName } from "./templates";

interface EmailProvider {
  name: string;
  send(msg: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

class ConsoleProvider implements EmailProvider {
  name = "console";
  async send(msg: { to: string; subject: string; text: string }) {
    console.info(`\n[email] → ${msg.to}\n  ${msg.subject}\n  ${msg.text.replace(/\n/g, "\n  ")}\n`);
  }
}

class SmtpProvider implements EmailProvider {
  name = "smtp";
  private transport = nodemailer.createTransport({
    host: env.email.smtp.host,
    port: env.email.smtp.port,
    secure: env.email.smtp.secure,
    auth: env.email.smtp.user ? { user: env.email.smtp.user, pass: env.email.smtp.pass } : undefined,
  });
  async send(msg: { to: string; subject: string; html: string; text: string }) {
    await this.transport.sendMail({ from: env.email.from, ...msg });
  }
}

let provider: EmailProvider | null = null;
function getProvider() {
  provider ??= env.email.driver === "smtp" && env.email.smtp.host ? new SmtpProvider() : new ConsoleProvider();
  return provider;
}

/** Envia e-mail transacional. Falhas não interrompem o fluxo principal. */
export async function sendEmail(
  to: string,
  template: EmailTemplateName,
  vars: { name: string; planName?: string; amount?: string; expiresAt?: string; link?: string; reason?: string },
) {
  const site = await getSiteConfig().catch(() => null);
  const { subject, html, text } = renderEmail(template, {
    siteName: site?.identity.siteName ?? "Umbra",
    appUrl: env.appUrl,
    ...vars,
  });
  const p = getProvider();
  try {
    await p.send({ to, subject, html, text });
    await db.emailLog.create({ data: { to, template, subject, provider: p.name, status: p.name === "console" ? "LOGGED" : "SENT" } });
  } catch (err) {
    console.error("[email]", err);
    await db.emailLog
      .create({ data: { to, template, subject, provider: p.name, status: "FAILED", error: String(err).slice(0, 500) } })
      .catch(() => {});
  }
}
