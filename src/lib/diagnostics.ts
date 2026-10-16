// Opt-in problem report. Nothing here is sent anywhere: the user reads the text file and
// chooses whether to share it. It holds counts and error messages, never names, phone
// numbers, amounts or bank details.

const ERROR_LOG_KEY = 'errorLog';
export const MAX_LOGGED_ERRORS = 20;
const MAX_MESSAGE = 300;
const MAX_STACK = 600;

export interface ErrorEntry {
  time: string; // ISO
  message: string;
  stack?: string;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** Turns anything that was thrown into a short, storable entry. */
export function toErrorEntry(error: unknown, now: Date = new Date()): ErrorEntry {
  if (error instanceof Error) {
    return {
      time: now.toISOString(),
      message: clip(`${error.name}: ${error.message}`, MAX_MESSAGE),
      stack: error.stack ? clip(error.stack.split('\n').slice(0, 6).join('\n'), MAX_STACK) : undefined,
    };
  }
  return { time: now.toISOString(), message: clip(String(error), MAX_MESSAGE) };
}

/** Appends an entry, keeping only the most recent ones. */
export function appendError(log: ErrorEntry[], entry: ErrorEntry): ErrorEntry[] {
  return [...log, entry].slice(-MAX_LOGGED_ERRORS);
}

export function readErrors(): ErrorEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed as ErrorEntry[] : [];
  } catch {
    return [];
  }
}

export function recordError(error: unknown, now: Date = new Date()): void {
  try {
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(appendError(readErrors(), toErrorEntry(error, now))));
  } catch {
    // Storage full or unavailable: losing a diagnostic entry is fine
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch {
    // nothing to clear
  }
}

/** Remembers uncaught errors and anything the app logs with console.error, for the problem report. */
export function installErrorCapture(): void {
  window.addEventListener('error', event => recordError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => recordError(event.reason));
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const error = args.find((arg): arg is Error => arg instanceof Error);
    if (error) recordError(error);
    original.apply(console, args);
  };
}

export interface ReportInput {
  now: Date;
  build: string;
  userAgent: string;
  language: string;
  online: boolean;
  installed: boolean;
  persisted: 'persisted' | 'not-persisted' | 'unsupported';
  dbVersion: number;
  counts: { clients: number; invoices: number; quotes: number };
  lastBackupAt: Date | null;
  errors: ErrorEntry[];
}

export function buildReport(input: ReportInput): string {
  const lines = [
    'MerchMate problem report',
    `Created: ${input.now.toISOString()}`,
    `App build: ${input.build}`,
    `Database version: ${input.dbVersion}`,
    `Device: ${input.userAgent}`,
    `Language: ${input.language}`,
    `Online: ${input.online ? 'yes' : 'no'}`,
    `Installed on home screen: ${input.installed ? 'yes' : 'no'}`,
    `Browser storage protection: ${input.persisted}`,
    `Records: ${input.counts.clients} clients, ${input.counts.invoices} invoices, ${input.counts.quotes} quotes`,
    `Last backup: ${input.lastBackupAt ? input.lastBackupAt.toISOString() : 'never'}`,
    '',
    `Recent errors (${input.errors.length}):`,
  ];
  if (input.errors.length === 0) lines.push('  none recorded');
  for (const entry of input.errors) {
    lines.push(`- ${entry.time}  ${entry.message}`);
    if (entry.stack) lines.push(...entry.stack.split('\n').slice(1).map(line => `    ${line.trim()}`));
  }
  lines.push('', 'This report has no client names, phone numbers, amounts or bank details.');
  return lines.join('\n');
}

export function reportFileName(now: Date = new Date()): string {
  return `merchmate-report-${now.toISOString().slice(0, 10)}.txt`;
}
