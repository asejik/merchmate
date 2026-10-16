/**
 * Extends a small control's tap area to about 44px tall without changing how it looks (an invisible
 * layer over it). For compact chips and links; use real min-h-11/min-w-11 where the layout allows.
 */
export const HIT_AREA = "relative after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']";

/**
 * Text fields: 44px tall (a comfortable tap) and 16px text. Below 16px, iPhones zoom the whole page
 * when a field is focused, which breaks the layout.
 */
export const INPUT_CLASS = "w-full min-h-11 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all";
export const LABEL_CLASS = "block text-xs font-medium text-slate-400 mb-1 uppercase";
