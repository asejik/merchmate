import { clsx } from 'clsx';

export type ChipTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-sunken text-muted',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
};

/** A small status label. Every tone keeps at least 4.5:1 contrast in light and dark (docs/DESIGN.md). */
export function Chip({ tone = 'neutral', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}
