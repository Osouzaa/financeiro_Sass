import { parseEnv } from './env';

const base = {
  DATABASE_URL: 'sqlserver://localhost:1433;database=Financeiro',
  JWT_ACCESS_SECRET: 'um-segredo-de-teste-com-mais-de-32-caracteres',
};

describe('parseEnv', () => {
  it('aplica valores padrão', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('falha com mensagem clara quando falta configuração', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('impede o segredo de exemplo em produção', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'troque-este-segredo-por-um-valor-aleatorio-longo',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
