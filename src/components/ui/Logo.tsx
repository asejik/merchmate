interface LogoProps {
  /** Pixel size of the mark. */
  size?: number;
  /** Also show the name next to the mark. */
  wordmark?: boolean;
  className?: string;
}

/**
 * The MerchMate mark: a folded page holding an M. The colours come from the theme tokens, so it
 * follows light and dark. The app icons and favicon are drawn from the same shapes (see
 * docs/DESIGN.md); change them together.
 */
export function Logo({ size = 28, wordmark = false, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M7 3H33L43 13V45H7Z" fill="var(--primary)" />
        <path d="M33 3V13H43Z" fill="var(--accent)" />
        <path d="M14 36V18L24 29L34 18V36" fill="none" stroke="var(--paper)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {wordmark && (
        <span className="text-lg font-extrabold tracking-tight text-ink">
          Merch<span className="text-primary">Mate</span>
        </span>
      )}
    </span>
  );
}
