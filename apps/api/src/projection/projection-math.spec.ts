import { buildProjection } from './projection-math';

const event = (date: string, amountCents: number, description = 'X') => ({
  date,
  amountCents,
  description,
  kind: 'transaction' as const,
  accountName: 'Conta',
});

describe('buildProjection', () => {
  it('aplica entradas e saídas no dia e acumula o saldo', () => {
    const projection = buildProjection(100_000, '2026-11-01', '2026-11-05', [
      event('2026-11-02', -30_000),
      event('2026-11-02', 50_000),
      event('2026-11-04', -150_000),
    ]);
    expect(projection.points.map((p) => p.balanceCents)).toEqual([
      100_000, 120_000, 120_000, -30_000, -30_000,
    ]);
    expect(projection.points[1]).toMatchObject({ inCents: 50_000, outCents: 30_000 });
    expect(projection.endBalanceCents).toBe(-30_000);
  });

  it('acha o menor saldo e o primeiro dia negativo', () => {
    const projection = buildProjection(10_000, '2026-11-01', '2026-11-04', [
      event('2026-11-02', -15_000),
      event('2026-11-03', -5_000),
      event('2026-11-04', 50_000),
    ]);
    expect(projection.lowest).toEqual({ date: '2026-11-03', balanceCents: -10_000 });
    expect(projection.firstNegativeDate).toBe('2026-11-02');
  });

  it('previsto atrasado entra hoje e é marcado; fora do período é ignorado', () => {
    const projection = buildProjection(0, '2026-11-10', '2026-11-12', [
      event('2026-11-01', -2_000, 'Conta de luz'),
      event('2026-12-01', -9_999),
    ]);
    expect(projection.points[0]!.balanceCents).toBe(-2_000);
    expect(projection.events).toEqual([
      expect.objectContaining({ date: '2026-11-10', overdue: true, description: 'Conta de luz' }),
    ]);
  });

  it('sem movimentos, o saldo fica reto e não há dia negativo', () => {
    const projection = buildProjection(5_000, '2026-11-01', '2026-11-30', []);
    expect(projection.points).toHaveLength(30);
    expect(projection.firstNegativeDate).toBeNull();
    expect(projection.lowest.balanceCents).toBe(5_000);
  });
});
