import { describe, expect, it } from 'vitest';
import { getSetupSteps, nextSetupStep } from './onboarding';

describe('first-run checklist', () => {
  it('starts with everything to do, in the order a new user needs it', () => {
    const steps = getSetupSteps({ hasBusiness: false, clients: 0, invoices: 0 });
    expect(steps.map(s => s.id)).toEqual(['business', 'client', 'invoice']);
    expect(steps.every(s => !s.done)).toBe(true);
    expect(nextSetupStep(steps)?.id).toBe('business');
  });

  it('ticks off each step as it is done', () => {
    const steps = getSetupSteps({ hasBusiness: true, clients: 2, invoices: 0 });
    expect(steps.map(s => s.done)).toEqual([true, true, false]);
    expect(nextSetupStep(steps)?.id).toBe('invoice');
  });

  it('is finished once all three exist', () => {
    expect(nextSetupStep(getSetupSteps({ hasBusiness: true, clients: 1, invoices: 1 }))).toBeNull();
  });

  it('points at the first gap even if a later step was done out of order', () => {
    expect(nextSetupStep(getSetupSteps({ hasBusiness: false, clients: 1, invoices: 1 }))?.id).toBe('business');
  });
});
