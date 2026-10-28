/**
 * Logo do Financeiro.
 *
 * Bloco com o canto superior esquerdo arredondado e uma linha de saldo que
 * termina num ponto laranja: o saldo projetado, que é o centro do produto.
 */
export function LogoMark({
  size = 32,
  tone = 'dark',
  className = '',
}: {
  size?: number;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const block = tone === 'dark' ? '#1d1d1f' : '#ffffff';
  const line = tone === 'dark' ? '#ffffff' : '#1d1d1f';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 0H32V32H0V9A9 9 0 0 1 9 0Z" fill={block} />
      <path
        d="M6.5 21.5L12 16l4.5 3.5L23 11"
        fill="none"
        stroke={line}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="9.5" r="2.75" fill="#ff682c" />
    </svg>
  );
}

export function Logo({
  size = 28,
  tone = 'dark',
  className = '',
}: {
  size?: number;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} tone={tone} />
      <span
        className={`font-display font-semibold leading-none tracking-[-0.03em] ${
          tone === 'dark' ? 'text-graphite' : 'text-white'
        }`}
        style={{ fontSize: size * 0.68 }}
      >
        financeiro
      </span>
    </span>
  );
}
