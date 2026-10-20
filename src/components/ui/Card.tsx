import { twMerge } from 'tailwind-merge';

/** A flat surface with a hairline border: the one card style of the new design. */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('rounded-2xl border border-line bg-surface shadow-card', className)} {...props}>
      {children}
    </div>
  );
}
