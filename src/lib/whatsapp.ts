import type { BusinessProfile, Customer, Invoice } from '../types';
import { formatMoney } from './currency';
import { getBalance, isOverdue, todayInputValue, toDateInputValue } from './invoice';

export const DEFAULT_COUNTRY_CODE = '234';

/**
 * Converts a locally written number to the international digits wa.me expects.
 * "0803 123 4567" -> "2348031234567"; "+44 7700 900123" and "0044..." keep their own country code.
 */
export function toWhatsAppNumber(phone: string, defaultCountryCode: string = DEFAULT_COUNTRY_CODE): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  const code = defaultCountryCode.replace(/\D/g, '');
  if (digits.startsWith('0')) return code + digits.slice(1);
  if (code && digits.startsWith(code)) return digits;
  return code + digits;
}

const formatDay = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type PaymentDetails = Pick<BusinessProfile, 'businessName' | 'bankName' | 'accountNumber' | 'accountName'>;

const firstNameOf = (customer: Pick<Customer, 'name'>) => customer.name.trim().split(/\s+/)[0] || customer.name;

function paymentDetailLines(business: PaymentDetails): string[] {
  if (!business.bankName || !business.accountNumber) return [];
  return ['', 'Payment details:', `${business.bankName}`, `${business.accountNumber}`, `${business.accountName}`];
}

/** "Your order is ready" message, asking for any balance before pickup or delivery. */
export function buildReadyMessage(invoice: Invoice, customer: Pick<Customer, 'name'>, business: PaymentDetails): string {
  const balance = getBalance(invoice);
  const lines = [
    `Hello ${firstNameOf(customer)},`,
    '',
    `Good news! Your order from ${business.businessName} (invoice #${invoice.invoiceNumber}) is ready.`,
  ];
  if (balance > 0) {
    lines.push(`Balance to pay before pickup or delivery: *${formatMoney(balance, invoice.currency)}*`, ...paymentDetailLines(business));
  }
  lines.push('', 'Thank you!');
  return lines.join('\n');
}

/** The message the WhatsApp button sends: "order ready" once it is ready, otherwise a payment reminder. */
export function buildClientMessage(invoice: Invoice, customer: Pick<Customer, 'name'>, business: PaymentDetails): string {
  return invoice.orderStage === 'ready' ? buildReadyMessage(invoice, customer, business) : buildReminderMessage(invoice, customer, business);
}

export function buildReminderMessage(
  invoice: Invoice,
  customer: Pick<Customer, 'name'>,
  business: PaymentDetails,
  today: string = todayInputValue(),
): string {
  const balance = formatMoney(getBalance(invoice), invoice.currency);
  const firstName = firstNameOf(customer);

  let dueLine: string;
  if (invoice.dueDate && isOverdue(invoice, today)) {
    dueLine = `was due on ${formatDay(invoice.dueDate)}`;
  } else if (invoice.dueDate && toDateInputValue(invoice.dueDate) === today) {
    dueLine = 'is due today';
  } else if (invoice.dueDate) {
    dueLine = `is due on ${formatDay(invoice.dueDate)}`;
  } else {
    dueLine = 'is still outstanding';
  }

  const lines = [
    `Hello ${firstName},`,
    '',
    `This is a friendly reminder from ${business.businessName} that invoice #${invoice.invoiceNumber} ${dueLine}.`,
    `Balance due: *${balance}*`,
  ];

  lines.push(...paymentDetailLines(business), '', 'Please ignore this message if you have already paid. Thank you!');
  return lines.join('\n');
}

export function whatsAppLink(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
