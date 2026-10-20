import { clsx } from 'clsx';

import { CHIP_TONES, type ChipTone } from './chipTones';

export type { ChipTone };

/** A small status label. Every tone keeps at least 4.5:1 contrast in light and dark (docs/DESIGN.md). */
export function Chip({ tone = 'neutral', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', CHIP_TONES[tone], className)}>
      {children}
    </span>
  );
}
