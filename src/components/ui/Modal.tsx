import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/format';
import { Button } from './Button';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' };

export function Modal({ title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-carbon/55 sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white sm:rounded-xl', WIDTHS[size])}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-carbon/5">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Volver</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink">{message}</div>
    </Modal>
  );
}
