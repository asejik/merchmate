import { describe, expect, it } from 'vitest';
import { failed } from './messages';

describe('failed', () => {
  it('says what could not be done and what to do next, without jargon', () => {
    const text = failed('save the client');
    expect(text).toContain("Couldn't save the client.");
    expect(text).toContain('try again');
    expect(text).toContain('Report a Problem');
    expect(text).not.toMatch(/error|exception|undefined|null/i);
  });
});
