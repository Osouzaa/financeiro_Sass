import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from './auth';

describe('registerSchema', () => {
  const base = {
    name: 'Gabriel',
    email: 'g@exemplo.com',
    password: 'senha1234',
    acceptTerms: true,
  };

  it('exige CPF válido e guarda só os dígitos', () => {
    expect(registerSchema.parse({ ...base, cpf: '529.982.247-25' }).cpf).toBe('52998224725');
    expect(registerSchema.safeParse({ ...base, cpf: '529.982.247-24' }).success).toBe(false);
    expect(registerSchema.safeParse(base).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('aceita e-mail ou CPF no mesmo campo e limita o tamanho', () => {
    expect(loginSchema.safeParse({ identifier: '529.982.247-25', password: 'x' }).success).toBe(
      true,
    );
    expect(loginSchema.safeParse({ identifier: 'g@exemplo.com', password: 'x' }).success).toBe(
      true,
    );
    expect(loginSchema.safeParse({ identifier: 'a'.repeat(300), password: 'x' }).success).toBe(
      false,
    );
  });
});

describe('resetPasswordSchema', () => {
  const token = 'a'.repeat(43);

  it('confere a confirmação e as regras de senha', () => {
    expect(
      resetPasswordSchema.safeParse({
        token,
        newPassword: 'nova12345',
        confirmPassword: 'nova12345',
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        token,
        newPassword: 'nova12345',
        confirmPassword: 'outra123',
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token, newPassword: 'curta', confirmPassword: 'curta' })
        .success,
    ).toBe(false);
  });

  it('recusa token com caracteres fora do formato', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: '../../etc/passwd',
        newPassword: 'nova12345',
        confirmPassword: 'nova12345',
      }).success,
    ).toBe(false);
  });
});

describe('aceite dos termos', () => {
  it('cadastro sem aceitar os termos é recusado', () => {
    const result = registerSchema.safeParse({
      name: 'Gabriel',
      email: 'g@exemplo.com',
      cpf: '529.982.247-25',
      password: 'senha1234',
      acceptTerms: false,
    });
    expect(result.error?.issues[0]?.path).toEqual(['acceptTerms']);
  });
});
