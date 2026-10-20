/**
 * Extends a small control's tap area to about 44px tall without changing how it looks (an invisible
 * layer over it). For compact chips and links; use real min-h-11/min-w-11 where the layout allows.
 */
export const HIT_AREA = "relative after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']";

/** Buttons of the new design. 44px tall, one primary per screen; the rest are secondary or ghost. */
const BUTTON = "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold transition-colors duration-150 disabled:opacity-60";
export const BUTTON_PRIMARY = `${BUTTON} bg-primary text-on-primary hover:bg-primary-hover`;
export const BUTTON_SECONDARY = `${BUTTON} border border-line-strong bg-surface text-primary hover:bg-primary-tint`;
export const BUTTON_GHOST = `${BUTTON} text-muted hover:bg-sunken hover:text-ink`;

/** Fields and labels of the new design (the INPUT_CLASS pair above is for screens not yet moved). */
export const FIELD_CLASS = "w-full min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-primary focus:outline-none";
export const FIELD_LABEL = "mb-1 block text-sm font-medium text-ink";
export const OVERLAY_CLASS = "fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4";
