/**
 * Wording for something that went wrong. Say what could not be done and what to try next, with no
 * technical detail (that goes to the console and the problem report).
 */
export function failed(what: string): string {
  return `Couldn't ${what}. Please try again. If it keeps happening, go to Settings and choose Report a Problem.`;
}
