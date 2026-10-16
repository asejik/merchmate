import { describe, expect, it } from 'vitest';
import { appendError, buildReport, MAX_LOGGED_ERRORS, reportFileName, toErrorEntry, type ReportInput } from './diagnostics';
import { isIOS, shouldSuggestInstall, type PlatformInfo } from './platform';

const now = new Date('2026-10-16T09:30:00Z');

describe('error log', () => {
  it('keeps only the most recent errors', () => {
    let log: ReturnType<typeof appendError> = [];
    for (let i = 0; i < MAX_LOGGED_ERRORS + 5; i++) log = appendError(log, toErrorEntry(new Error(`e${i}`), now));
    expect(log).toHaveLength(MAX_LOGGED_ERRORS);
    expect(log.at(-1)?.message).toContain(`e${MAX_LOGGED_ERRORS + 4}`);
    expect(log[0].message).toContain('e5');
  });

  it('shortens long messages and handles things that are not Errors', () => {
    expect(toErrorEntry(new Error('x'.repeat(1000)), now).message.length).toBeLessThan(400);
    expect(toErrorEntry('plain text', now)).toEqual({ time: now.toISOString(), message: 'plain text' });
    expect(toErrorEntry(undefined, now).message).toBe('undefined');
  });
});

describe('buildReport', () => {
  const input: ReportInput = {
    now, build: '2026-10-16T08:00:00Z', userAgent: 'Mozilla/5.0 (Linux; Android 13)', language: 'en-NG', online: false,
    installed: true, persisted: 'not-persisted', dbVersion: 3, counts: { clients: 12, invoices: 40, quotes: 3 },
    lastBackupAt: null, errors: [toErrorEntry(new Error('boom'), now)],
  };

  it('lists the facts needed to diagnose a problem', () => {
    const text = buildReport(input);
    expect(text).toContain('12 clients, 40 invoices, 3 quotes');
    expect(text).toContain('Browser storage protection: not-persisted');
    expect(text).toContain('Last backup: never');
    expect(text).toContain('Error: boom');
    expect(text).toContain('Online: no');
  });

  it('says so when nothing went wrong', () => {
    expect(buildReport({ ...input, errors: [] })).toContain('none recorded');
  });

  it('is named by day', () => {
    expect(reportFileName(now)).toBe('merchmate-report-2026-10-16.txt');
  });
});

describe('install suggestion', () => {
  const iphone: PlatformInfo = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, standalone: false };

  it('suggests installing on iPhone and iPad browsers only', () => {
    expect(shouldSuggestInstall(iphone)).toBe(true);
    expect(shouldSuggestInstall({ ...iphone, standalone: true })).toBe(false);
    expect(shouldSuggestInstall({ userAgent: 'Mozilla/5.0 (Linux; Android 13)', platform: 'Linux armv8l', maxTouchPoints: 5, standalone: false })).toBe(false);
  });

  it('recognises an iPad that reports itself as a Mac, but not a real Mac', () => {
    const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5, standalone: false };
    expect(isIOS(ipad)).toBe(true);
    expect(isIOS({ ...ipad, maxTouchPoints: 0 })).toBe(false);
  });
});
