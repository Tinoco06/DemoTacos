import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  full?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-frambuesa text-white hover:bg-frambuesa-dark',
  secondary: 'border border-line bg-white text-ink hover:bg-marfil',
  ghost: 'text-ink hover:bg-carbon/5',
  danger: 'border border-bad/30 bg-white text-bad hover:bg-bad-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-base',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, full, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'lg' ? 'size-5' : 'size-4'} aria-hidden />}
      {children}
    </button>
  );
}
