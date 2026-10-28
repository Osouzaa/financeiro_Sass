import { describe, expect, it } from 'vitest';
import { categoryInputSchema } from './category';

describe('categoryInputSchema', () => {
  it('aceita categoria com cor e ícone da lista', () => {
    const parsed = categoryInputSchema.parse({
      name: '  Viagens ',
      type: 'EXPENSE',
      color: '#ff682c',
      icon: 'plane',
    });
    expect(parsed.name).toBe('Viagens');
  });

  it('recusa ícone fora da lista e cor em outro formato', () => {
    const result = categoryInputSchema.safeParse({
      name: 'X',
      type: 'EXPENSE',
      color: 'red',
      icon: '<img src=x onerror=alert(1)>',
    });
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['color', 'icon']));
  });

  it('recusa nome vazio e tipo transferência', () => {
    expect(categoryInputSchema.safeParse({ name: '  ', type: 'EXPENSE' }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: 'X', type: 'TRANSFER' }).success).toBe(false);
  });
});
