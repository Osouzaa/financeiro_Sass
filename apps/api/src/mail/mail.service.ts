import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../config/app-config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envio de e-mail. Com SMTP configurado, envia de verdade; sem ele (só permitido
 * fora de produção, ver env.ts), registra a mensagem no terminal para o
 * desenvolvedor abrir o link sem precisar de um servidor de e-mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: AppConfig) {
    const mail = config.mail;
    this.from = mail.from;
    this.transporter = mail.host
      ? createTransport({
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado; e-mail que seria enviado:\n` +
          `  Para: ${message.to}\n  Assunto: ${message.subject}\n\n${message.text}\n`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
