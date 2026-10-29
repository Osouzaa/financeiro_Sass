import type { MailMessage } from './mail.service';

/** Nada vindo do usuário entra no HTML sem escapar (o nome, por exemplo). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Layout simples e inline: clientes de e-mail ignoram CSS externo. */
function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1d1d1f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e4de;border-radius:16px">
        <tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:bold">${title}</td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6">${body}</td></tr>
      </table>
      <p style="font-size:12px;color:#7a7a80;margin-top:16px">Financeiro · controle financeiro pessoal</p>
    </td></tr>
  </table>
</body></html>`;
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  link: string;
  minutes: number;
}): MailMessage {
  const firstName = input.name.split(' ')[0] ?? input.name;
  const name = escapeHtml(firstName);
  const link = escapeHtml(input.link);
  return {
    to: input.to,
    subject: 'Redefinir sua senha',
    text:
      `Olá, ${firstName}.\n\n` +
      `Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova, abra o link abaixo ` +
      `em até ${input.minutes} minutos:\n\n${input.link}\n\n` +
      `Se não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: layout(
      'Redefinir sua senha',
      `<p>Olá, ${name}.</p>
       <p>Recebemos um pedido para redefinir a senha da sua conta. O link vale por ${input.minutes} minutos e só pode ser usado uma vez.</p>
       <p style="margin:24px 0"><a href="${link}" style="background:#1d1d1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Criar nova senha</a></p>
       <p style="font-size:13px;color:#7a7a80">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${link}</span></p>
       <p style="font-size:13px;color:#7a7a80">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
    ),
  };
}

export function passwordChangedEmail(input: { to: string; name: string }): MailMessage {
  const firstName = input.name.split(' ')[0] ?? input.name;
  return {
    to: input.to,
    subject: 'Sua senha foi alterada',
    text:
      `Olá, ${firstName}.\n\nA senha da sua conta acabou de ser redefinida e todas as sessões abertas foram encerradas.\n\n` +
      `Se não foi você, peça uma nova redefinição agora mesmo e troque também a senha do seu e-mail.`,
    html: layout(
      'Sua senha foi alterada',
      `<p>Olá, ${escapeHtml(firstName)}.</p>
       <p>A senha da sua conta acabou de ser redefinida e todas as sessões abertas foram encerradas.</p>
       <p style="font-size:13px;color:#7a7a80">Se não foi você, peça uma nova redefinição agora mesmo e troque também a senha do seu e-mail.</p>`,
    ),
  };
}

export function emailVerificationEmail(input: {
  to: string;
  name: string;
  link: string;
  hours: number;
}): MailMessage {
  const firstName = input.name.split(' ')[0] ?? input.name;
  const link = escapeHtml(input.link);
  return {
    to: input.to,
    subject: 'Confirme seu e-mail',
    text:
      `Olá, ${firstName}.\n\nConfirme que este e-mail é seu para receber avisos e recuperar o acesso ` +
      `quando precisar. O link vale por ${input.hours} horas:\n\n${input.link}\n\n` +
      `Se você não criou uma conta, ignore este e-mail.`,
    html: layout(
      'Confirme seu e-mail',
      `<p>Olá, ${escapeHtml(firstName)}.</p>
       <p>Confirme que este e-mail é seu para receber avisos e recuperar o acesso quando precisar.</p>
       <p style="margin:24px 0"><a href="${link}" style="background:#1d1d1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Confirmar e-mail</a></p>
       <p style="font-size:13px;color:#7a7a80">O link vale por ${input.hours} horas. Se o botão não funcionar, copie este endereço:<br><span style="word-break:break-all">${link}</span></p>
       <p style="font-size:13px;color:#7a7a80">Se você não criou uma conta, ignore este e-mail.</p>`,
    ),
  };
}
