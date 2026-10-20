import { useId } from 'react';

interface PinFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
}

/** Digits-only field: the phone shows its number pad, and the text is hidden. */
export function PinField({ label, value, onChange, autoFocus, autoComplete = 'off' }: PinFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted mb-1 tracking-wider">{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={8}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="w-full min-h-11 rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink text-center text-xl tracking-[0.4em] focus:outline-none focus:border-primary"
      />
    </div>
  );
}
