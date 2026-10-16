// First-run checklist: the three things a new user must do before MerchMate is useful.

export type SetupStepId = 'business' | 'client' | 'invoice';

export interface SetupStep {
  id: SetupStepId;
  title: string;
  hint: string;
  done: boolean;
}

export interface SetupState {
  hasBusiness: boolean;
  clients: number;
  invoices: number; // invoices and quotes
}

export function getSetupSteps({ hasBusiness, clients, invoices }: SetupState): SetupStep[] {
  return [
    { id: 'business', title: 'Add your business details', hint: 'Your name, phone and bank account appear on every invoice.', done: hasBusiness },
    { id: 'client', title: 'Add a client', hint: 'Who you are billing.', done: clients > 0 },
    { id: 'invoice', title: 'Create your first invoice', hint: 'Then share it as a PDF, an image or a WhatsApp message.', done: invoices > 0 },
  ];
}

/** The first step still to do, or null when setup is complete. */
export function nextSetupStep(steps: SetupStep[]): SetupStep | null {
  return steps.find(step => !step.done) ?? null;
}
