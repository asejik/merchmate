export type ChipTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-sunken text-muted',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
};
