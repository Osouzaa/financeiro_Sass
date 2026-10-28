/**
 * Logo do Financeiro.
 *
 * A marca é um bloco grafite com o canto superior esquerdo arredondado (o mesmo
 * canto assimétrico dos cards) e uma linha de saldo que termina num ponto laranja:
 * o saldo do dia 30, que é a pergunta que o produto responde.
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0H32V32H0V8A8 8 0 0 1 8 0Z" fill="#202020" />
      <path
        d="M6.5 21.5L12 16l4.5 3.5L23 11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="9.5" r="2.75" fill="#ff682c" />
    </svg>
  );
}

export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className="font-display leading-none tracking-[-0.03em] text-graphite"
        style={{ fontSize: size * 0.72 }}
      >
        financeiro
      </span>
    </span>
  );
}
