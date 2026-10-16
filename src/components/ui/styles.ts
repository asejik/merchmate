/**
 * Extends a small control's tap area to about 44px tall without changing how it looks (an invisible
 * layer over it). For compact chips and links; use real min-h-11/min-w-11 where the layout allows.
 */
export const HIT_AREA = "relative after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']";
