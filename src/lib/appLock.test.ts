import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_LOCK_MS, changePin, clearLock, disableLock, enableLock, failureMessage, formatWait, FREE_ATTEMPTS, generateRecoveryCode, isLockEnabled, isValidPin,
  lockoutRemainingMs, normalizeRecoveryCode, resetPinWithRecovery, verifyPin, type LockStorage,
} from './appLock';

const memory = (): LockStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) };
};

let storage: ReturnType<typeof memory>;
const T0 = 1_000_000;
const fast = { iterations: 1000 }; // the real lock uses 150,000; tests only need the logic

async function enabled(pin = '1234') {
  const result = await enableLock(pin, { storage, ...fast });
  if (!result.ok) throw new Error('enable failed');
  return result.recoveryCode;
}

const wrongGuesses = async (n: number, at = T0) => {
  let last;
  for (let i = 0; i < n; i++) last = await verifyPin('0000', { storage, now: at });
  return last!;
};

beforeEach(() => { storage = memory(); });

describe('PIN rules', () => {
  it('needs 4 to 8 digits', () => {
    for (const ok of ['1234', '123456', '12345678']) expect(isValidPin(ok)).toBe(true);
    for (const bad of ['123', '123456789', 'abcd', '12 34', '', '12.4']) expect(isValidPin(bad)).toBe(false);
  });

  it('refuses to turn on with a bad PIN', async () => {
    expect(await enableLock('12', { storage, ...fast })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(isLockEnabled(storage)).toBe(false);
  });
});

describe('turning the lock on', () => {
  it('is off until you enable it, and never stores the PIN or the code in readable form', async () => {
    expect(isLockEnabled(storage)).toBe(false);
    expect(await verifyPin('anything', { storage })).toEqual({ ok: true }); // nothing to unlock
    const code = await enabled('4821');
    expect(isLockEnabled(storage)).toBe(true);
    const stored = storage.data.get('appLock')!;
    expect(stored).not.toContain('4821');
    expect(stored).not.toContain(code.replace(/-/g, ''));
    expect(stored).not.toContain(code);
  });

  it('salts every secret, so equal PINs do not look equal', async () => {
    await enableLock('1234', { storage, ...fast });
    const a = JSON.parse(storage.data.get('appLock')!).pin;
    const other = memory();
    await enableLock('1234', { storage: other, ...fast });
    const b = JSON.parse(other.data.get('appLock')!).pin;
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('unlocking', () => {
  it('accepts the right PIN and rejects a wrong one', async () => {
    await enabled('4821');
    expect(await verifyPin('4821', { storage, now: T0 })).toEqual({ ok: true });
    expect(await verifyPin('4822', { storage, now: T0 })).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: FREE_ATTEMPTS - 1 });
  });

  it('a correct PIN clears the count of wrong guesses', async () => {
    await enabled();
    await wrongGuesses(FREE_ATTEMPTS - 1);
    expect(await verifyPin('1234', { storage, now: T0 })).toEqual({ ok: true });
    expect(await verifyPin('0000', { storage, now: T0 })).toMatchObject({ attemptsLeft: FREE_ATTEMPTS - 1 });
  });
});

describe('lockout after wrong attempts', () => {
  beforeEach(async () => { await enabled(); });

  it('makes you wait 30 seconds after five wrong guesses, even for the right PIN', async () => {
    const fifth = await wrongGuesses(FREE_ATTEMPTS);
    expect(fifth).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: 0, retryInMs: 30_000 });
    expect(lockoutRemainingMs(storage, T0 + 10_000)).toBe(20_000);
    expect(await verifyPin('1234', { storage, now: T0 + 10_000 })).toMatchObject({ ok: false, reason: 'locked', retryInMs: 20_000 });
    expect(await verifyPin('1234', { storage, now: T0 + 30_000 })).toEqual({ ok: true });
  });

  it('doubles the wait with each further wrong guess, up to 15 minutes', async () => {
    await wrongGuesses(FREE_ATTEMPTS);
    const sixth = await verifyPin('0000', { storage, now: T0 + 30_000 });
    expect(sixth).toMatchObject({ retryInMs: 60_000 });
    let t = T0 + 90_000, last = sixth;
    for (let i = 0; i < 12; i++) { last = await verifyPin('0000', { storage, now: t }); t += last.ok ? 0 : last.retryInMs; }
    expect(!last.ok && last.retryInMs).toBe(15 * 60_000);
  });

  it('remembers the wait after the app is reloaded', async () => {
    await wrongGuesses(FREE_ATTEMPTS);
    // a "reload" re-reads the same storage with no in-memory state
    expect(lockoutRemainingMs(storage, T0 + 1000)).toBe(29_000);
    expect(await verifyPin('1234', { storage, now: T0 + 1000 })).toMatchObject({ reason: 'locked' });
  });
});

describe('changing and removing the PIN', () => {
  it('needs the current PIN, and a wrong one counts as a failed guess', async () => {
    await enabled('1234');
    expect(await changePin('9999', '5678', { storage, now: T0 })).toMatchObject({ ok: false, reason: 'wrong' });
    expect(await verifyPin('1234', { storage, now: T0 })).toEqual({ ok: true });
    expect(await changePin('1234', '5678', { storage, now: T0 })).toEqual({ ok: true });
    expect(await verifyPin('1234', { storage, now: T0 })).toMatchObject({ ok: false });
    expect(await verifyPin('5678', { storage, now: T0 })).toEqual({ ok: true });
    expect(await changePin('5678', 'abc', { storage, now: T0 })).toMatchObject({ reason: 'invalid' });
  });

  it('turning the lock off needs the PIN', async () => {
    await enabled('1234');
    expect(await disableLock('0000', { storage, now: T0 })).toMatchObject({ ok: false });
    expect(isLockEnabled(storage)).toBe(true);
    expect(await disableLock('1234', { storage, now: T0 })).toEqual({ ok: true });
    expect(isLockEnabled(storage)).toBe(false);
  });
});

describe('forgot the PIN: recovery code', () => {
  it('sets a new PIN, retires the old PIN and the old code, and issues a new code', async () => {
    const code = await enabled('1234');
    const reset = await resetPinWithRecovery(code, '8642', { storage, now: T0, ...fast });
    expect(reset.ok).toBe(true);
    const next = reset.ok ? reset.recoveryCode : '';
    expect(next).not.toBe(code);
    expect(await verifyPin('1234', { storage, now: T0 })).toMatchObject({ ok: false });
    expect(await verifyPin('8642', { storage, now: T0 })).toEqual({ ok: true });
    expect(await resetPinWithRecovery(code, '1111', { storage, now: T0 })).toMatchObject({ ok: false });
    expect((await resetPinWithRecovery(next, '1111', { storage, now: T0 })).ok).toBe(true);
  });

  it('accepts the code in any case, with spaces or no dashes', async () => {
    const code = await enabled();
    const sloppy = code.toLowerCase().replace(/-/g, ' ');
    expect((await resetPinWithRecovery(sloppy, '5555', { storage, now: T0 })).ok).toBe(true);
  });

  it('shares the wrong-guess count and wait with the PIN, so it cannot be used to guess faster', async () => {
    const code = await enabled();
    await wrongGuesses(FREE_ATTEMPTS - 1);
    expect(await resetPinWithRecovery('AAAA-AAAA-AAAA', '5555', { storage, now: T0 })).toMatchObject({ ok: false, reason: 'wrong', retryInMs: 30_000 });
    expect(await resetPinWithRecovery(code, '5555', { storage, now: T0 + 1000 })).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('rejects an invalid new PIN without spending the code', async () => {
    const code = await enabled();
    expect(await resetPinWithRecovery(code, '12', { storage, now: T0 })).toMatchObject({ reason: 'invalid' });
    expect((await resetPinWithRecovery(code, '5555', { storage, now: T0 })).ok).toBe(true);
  });
});

describe('recovery codes', () => {
  it('look like XXXX-XXXX-XXXX with no easily confused characters', () => {
    for (let i = 0; i < 50; i++) expect(generateRecoveryCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it('are different every time', () => {
    expect(new Set(Array.from({ length: 200 }, () => generateRecoveryCode())).size).toBe(200);
  });

  it('are not biased towards the start of the alphabet', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const ch of generateRecoveryCode().replace(/-/g, '')) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const values = [...counts.values()];
    expect(counts.size).toBe(31);
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(1.25);
  });

  it('normalise case, spaces and dashes', () => {
    expect(normalizeRecoveryCode('ab3d- e5fg hj6k')).toBe('AB3DE5FGHJ6K');
  });
});

describe('damaged or missing storage', () => {
  it('treats unreadable lock data as no lock, and removes it', () => {
    storage.setItem('appLock', '{not json');
    expect(isLockEnabled(storage)).toBe(false);
    expect(storage.data.has('appLock')).toBe(false);
    storage.setItem('appLock', JSON.stringify({ v: 1, pin: 'x' }));
    expect(isLockEnabled(storage)).toBe(false);
  });

  it('does not throw when storage is unavailable', () => {
    const broken: LockStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(isLockEnabled(broken)).toBe(false);
    expect(() => clearLock(broken)).not.toThrow();
  });

  it('clearLock removes the lock without the PIN (used when the device is erased)', async () => {
    await enabled();
    clearLock(storage);
    expect(isLockEnabled(storage)).toBe(false);
  });
});

describe('auto lock', () => {
  it('waits a minute in the background before locking again', () => {
    expect(AUTO_LOCK_MS).toBe(60_000);
  });
});

describe('wording', () => {
  it('rounds waits up and uses sensible units', () => {
    expect(formatWait(1)).toBe('1 second');
    expect(formatWait(28_100)).toBe('29 seconds');
    expect(formatWait(60_000)).toBe('1 minute');
    expect(formatWait(61_000)).toBe('2 minutes');
    expect(formatWait(15 * 60_000)).toBe('15 minutes');
  });

  it('tells the user how many tries are left, then how long to wait', () => {
    expect(failureMessage({ ok: false, reason: 'wrong', attemptsLeft: 2, retryInMs: 0 })).toBe('Wrong PIN. 2 tries left before a wait.');
    expect(failureMessage({ ok: false, reason: 'wrong', attemptsLeft: 1, retryInMs: 0 }, 'recovery code')).toBe('Wrong recovery code. 1 try left before a wait.');
    expect(failureMessage({ ok: false, reason: 'wrong', attemptsLeft: 0, retryInMs: 30_000 })).toContain('Try again in 30 seconds');
    expect(failureMessage({ ok: false, reason: 'locked', attemptsLeft: 0, retryInMs: 5000 })).toBe('Too many wrong tries. Try again in 5 seconds.');
    expect(failureMessage({ ok: false, reason: 'invalid', attemptsLeft: 5, retryInMs: 0 })).toContain('4 to 8 digits');
  });
});
