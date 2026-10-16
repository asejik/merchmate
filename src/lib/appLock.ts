// Optional screen lock: a PIN, a recovery code, and nothing on a server.
//
// This keeps casual snoopers out (a relative, a colleague, someone who picks up the phone). It is
// NOT encryption: the invoices stay readable in the browser's storage for anyone technical with
// the device, so the phone's own lock still matters. There is no account to reset it with, which
// is why a recovery code exists and why the last resort is to erase this device and restore a
// backup.

export type LockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const LOCK_KEY = 'appLock';
const DEFAULT_ITERATIONS = 150_000;
export const PIN_PATTERN = /^\d{4,8}$/;
/** Wrong guesses allowed before the lock starts making you wait. */
export const FREE_ATTEMPTS = 5;
const BASE_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;
/** How long the app can sit in the background before it locks again. */
export const AUTO_LOCK_MS = 60_000;

// No 0/O or 1/I/L, so a code copied by hand is not misread
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

interface Secret {
  salt: string;
  hash: string;
}

interface LockConfig {
  v: 1;
  iterations: number;
  pin: Secret;
  recovery: Secret;
  failed: number; // wrong guesses since the last success, PIN and recovery code together
  lockedUntil: number; // epoch ms
}

export interface LockOptions {
  storage?: LockStorage;
  now?: number;
  iterations?: number; // only used when creating a lock; lower in tests
  random?: (bytes: Uint8Array) => Uint8Array;
}

export type Failure = { ok: false; reason: 'wrong' | 'locked' | 'invalid'; attemptsLeft: number; retryInMs: number };
export type AttemptResult = { ok: true } | Failure;
export type CodeResult = { ok: true; recoveryCode: string } | Failure;

const defaultStorage = (): LockStorage => localStorage;
const defaultRandom = (bytes: Uint8Array): Uint8Array => crypto.getRandomValues(bytes);

export const isValidPin = (pin: string): boolean => PIN_PATTERN.test(pin);

// ---------- encoding and hashing ----------

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return toBase64(new Uint8Array(bits));
}

async function makeSecret(value: string, iterations: number, random: LockOptions['random'] = defaultRandom): Promise<Secret> {
  const salt = random(new Uint8Array(16));
  return { salt: toBase64(salt), hash: await derive(value, salt, iterations) };
}

async function matches(value: string, secret: Secret, iterations: number): Promise<boolean> {
  const candidate = await derive(value, fromBase64(secret.salt), iterations);
  if (candidate.length !== secret.hash.length) return false;
  let diff = 0; // compare every character so timing does not reveal where they differ
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ secret.hash.charCodeAt(i);
  return diff === 0;
}

// ---------- recovery code ----------

export function generateRecoveryCode(random: LockOptions['random'] = defaultRandom): string {
  const limit = 256 - (256 % CODE_ALPHABET.length); // reject the top bytes so no letter is likelier than another
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(new Uint8Array(CODE_LENGTH))) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code.match(/.{4}/g)!.join('-');
}

/** What the user typed -> the stored form: case, spaces and dashes do not matter. */
export const normalizeRecoveryCode = (input: string): string => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------- stored config ----------

const isSecret = (value: unknown): value is Secret =>
  typeof value === 'object' && value !== null && typeof (value as Secret).salt === 'string' && typeof (value as Secret).hash === 'string';

function readConfig(storage: LockStorage): LockConfig | null {
  try {
    const raw = storage.getItem(LOCK_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<LockConfig>;
    if (parsed.v === 1 && isSecret(parsed.pin) && isSecret(parsed.recovery) && Number.isInteger(parsed.iterations)
        && typeof parsed.failed === 'number' && typeof parsed.lockedUntil === 'number') {
      return parsed as LockConfig;
    }
  } catch {
    // unreadable: handled below
  }
  // A damaged lock cannot be verified. Opening up is the lesser evil: it protects against casual
  // access only, and anyone able to edit this storage could delete the lock anyway.
  try { storage.removeItem(LOCK_KEY); } catch { /* nothing more to do */ }
  return null;
}

function writeConfig(storage: LockStorage, config: LockConfig): void {
  storage.setItem(LOCK_KEY, JSON.stringify(config));
}

export function isLockEnabled(storage: LockStorage = defaultStorage()): boolean {
  try {
    return readConfig(storage) !== null;
  } catch {
    return false;
  }
}

/** Milliseconds until another guess is allowed (0 = allowed now). */
export function lockoutRemainingMs(storage: LockStorage = defaultStorage(), now: number = Date.now()): number {
  const config = readConfig(storage);
  return config ? Math.max(0, config.lockedUntil - now) : 0;
}

// ---------- operations ----------

const invalid: Failure = { ok: false, reason: 'invalid', attemptsLeft: FREE_ATTEMPTS, retryInMs: 0 };

/** Checks a guess against one stored secret, counting wrong guesses and enforcing the wait. */
async function attempt(which: 'pin' | 'recovery', guess: string, config: LockConfig, storage: LockStorage, now: number): Promise<AttemptResult> {
  if (now < config.lockedUntil) {
    return { ok: false, reason: 'locked', attemptsLeft: 0, retryInMs: config.lockedUntil - now };
  }
  if (await matches(guess, config[which], config.iterations)) {
    config.failed = 0;
    config.lockedUntil = 0;
    writeConfig(storage, config);
    return { ok: true };
  }
  config.failed += 1;
  if (config.failed >= FREE_ATTEMPTS) {
    config.lockedUntil = now + Math.min(BASE_WAIT_MS * 2 ** (config.failed - FREE_ATTEMPTS), MAX_WAIT_MS);
  }
  writeConfig(storage, config);
  return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, FREE_ATTEMPTS - config.failed), retryInMs: Math.max(0, config.lockedUntil - now) };
}

/** Turns the lock on. Returns the recovery code, which is shown once and never stored in readable form. */
export async function enableLock(pin: string, options: LockOptions = {}): Promise<CodeResult> {
  if (!isValidPin(pin)) return invalid;
  const { storage = defaultStorage(), iterations = DEFAULT_ITERATIONS, random = defaultRandom } = options;
  const recoveryCode = generateRecoveryCode(random);
  writeConfig(storage, {
    v: 1,
    iterations,
    pin: await makeSecret(pin, iterations, random),
    recovery: await makeSecret(normalizeRecoveryCode(recoveryCode), iterations, random),
    failed: 0,
    lockedUntil: 0,
  });
  return { ok: true, recoveryCode };
}

export async function verifyPin(pin: string, { storage = defaultStorage(), now = Date.now() }: LockOptions = {}): Promise<AttemptResult> {
  const config = readConfig(storage);
  if (!config) return { ok: true };
  return attempt('pin', pin, config, storage, now);
}

export async function changePin(current: string, next: string, options: LockOptions = {}): Promise<AttemptResult> {
  const { storage = defaultStorage(), now = Date.now(), random = defaultRandom } = options;
  const config = readConfig(storage);
  if (!config) return invalid;
  if (!isValidPin(next)) return invalid;
  const result = await attempt('pin', current, config, storage, now);
  if (!result.ok) return result;
  writeConfig(storage, { ...config, pin: await makeSecret(next, config.iterations, random) });
  return result;
}

export async function disableLock(pin: string, { storage = defaultStorage(), now = Date.now() }: LockOptions = {}): Promise<AttemptResult> {
  const config = readConfig(storage);
  if (!config) return { ok: true };
  const result = await attempt('pin', pin, config, storage, now);
  if (result.ok) storage.removeItem(LOCK_KEY);
  return result;
}

/** Forgot the PIN: the recovery code sets a new one and issues a fresh code (the old one stops working). */
export async function resetPinWithRecovery(code: string, newPin: string, options: LockOptions = {}): Promise<CodeResult> {
  const { storage = defaultStorage(), now = Date.now(), random = defaultRandom } = options;
  const config = readConfig(storage);
  if (!config || !isValidPin(newPin)) return invalid;
  const result = await attempt('recovery', normalizeRecoveryCode(code), config, storage, now);
  if (!result.ok) return result;
  const recoveryCode = generateRecoveryCode(random);
  writeConfig(storage, {
    ...config,
    pin: await makeSecret(newPin, config.iterations, random),
    recovery: await makeSecret(normalizeRecoveryCode(recoveryCode), config.iterations, random),
  });
  return { ok: true, recoveryCode };
}

/** Removes the lock without asking for the PIN. Only for "erase this device", which deletes the data it protects. */
export function clearLock(storage: LockStorage = defaultStorage()): void {
  try {
    storage.removeItem(LOCK_KEY);
  } catch {
    // storage unavailable: there is no lock to clear
  }
}

// ---------- wording ----------

/** "28 seconds", "3 minutes": rounded up so the count never reaches 0 while you still have to wait. */
export function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function failureMessage(failure: Failure, what: 'PIN' | 'recovery code' = 'PIN'): string {
  if (failure.reason === 'invalid') return what === 'PIN' ? 'Use 4 to 8 digits for the PIN.' : 'Check the recovery code and try again.';
  if (failure.reason === 'locked') return `Too many wrong tries. Try again in ${formatWait(failure.retryInMs)}.`;
  const left = failure.attemptsLeft > 0
    ? `${failure.attemptsLeft} ${failure.attemptsLeft === 1 ? 'try' : 'tries'} left before a wait.`
    : `Too many wrong tries. Try again in ${formatWait(failure.retryInMs)}.`;
  return `Wrong ${what}. ${left}`;
}
