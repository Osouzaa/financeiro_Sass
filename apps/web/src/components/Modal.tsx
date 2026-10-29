import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Janela modal sobre o <dialog> nativo: foco preso, Esc fecha e o fundo
 * fica inerte sem precisar de biblioteca.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** sm 440px, md 560px, lg 760px (formulários longos). */
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Só reage aos eventos do próprio <dialog>: num modal aberto dentro de outro,
      // o React propaga close/cancel pela árvore e fecharia os dois
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clique no fundo (fora do conteúdo) fecha
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto w-[min(94vw,var(--w))] rounded-[18px] border border-line bg-surface p-0 text-graphite shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)] backdrop:bg-black/45 backdrop:backdrop-blur-[2px]`}
      style={{ ['--w' as string]: { sm: '440px', md: '560px', lg: '760px' }[size] }}
    >
      {open ? (
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-slate">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-[10px] text-slate hover:bg-sunken hover:text-graphite"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-4">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
