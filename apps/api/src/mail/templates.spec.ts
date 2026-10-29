import { escapeHtml, passwordResetEmail } from './templates';

describe('templates de e-mail', () => {
  it('escapa o nome do usuário no HTML', () => {
    const mail = passwordResetEmail({
      to: 'a@b.com',
      name: '<script>alert(1)</script> Silva',
      link: 'http://localhost:5173/redefinir-senha?token=abc',
      minutes: 30,
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.text).toContain('http://localhost:5173/redefinir-senha?token=abc');
  });

  it('escapa aspas para não quebrar atributos', () => {
    expect(escapeHtml('" onclick="x')).toBe('&quot; onclick=&quot;x');
  });
});
