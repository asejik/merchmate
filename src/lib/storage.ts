export type Persistence = 'persisted' | 'not-persisted' | 'unsupported';

/** Whether the browser has promised not to clear this site's data when the phone runs low on space. */
export async function getPersistence(): Promise<Persistence> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** Asks for that promise. Browsers decide on their own, so check the result. */
export async function requestPersistence(): Promise<Persistence> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // fall through to report the real state
  }
  return getPersistence();
}
