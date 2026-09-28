import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Invoice, BusinessProfile, Customer } from '../../types';
import { DEFAULT_INVOICE_TERMS, getBalance, getPaymentHistory, isQuote } from '../../lib/invoice';
import { formatAmount, formatMoney } from '../../lib/currency';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  // FIX: Added alignItems: 'flex-start' to ensure logo stays left
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { flexDirection: 'column', alignItems: 'flex-start' }, // NEW STYLE HELPER

  logo: { width: 100, height: 'auto', marginBottom: 10 }, // Removed objectFit to prevent centering behavior

  brand: { fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', color: '#4F46E5' },
  label: { fontSize: 8, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 10, marginBottom: 8 },

  row: { flexDirection: 'row' },
  col2: { width: '50%' },

  table: { marginTop: 20, borderWidth: 1, borderColor: '#eee' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cellDesc: { flex: 2 },
  cellQty: { width: 40, textAlign: 'center' },
  cellPrice: { flex: 1, textAlign: 'right' },
  cellTotal: { flex: 1, textAlign: 'right' },

  totals: { marginTop: 20, alignSelf: 'flex-end', width: '45%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 8, fontWeight: 'bold', fontSize: 12 },

  historyTable: { marginTop: 15, marginBottom: 5, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  historyText: { fontSize: 8, color: '#666' },

  stampContainer: {
    position: 'absolute',
    top: 200,
    right: 40,
    transform: 'rotate(-15deg)',
    borderWidth: 4,
    borderColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    opacity: 0.5,
    zIndex: 100
  },
  stampText: {
    color: '#DC2626',
    fontSize: 30,
    fontWeight: 'black',
    textTransform: 'uppercase',
    textAlign: 'center'
  },

  notes: { marginTop: 24, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4 },

  ruleBox: { marginTop: 30, padding: 10, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 4 },
  ruleText: { color: '#DC2626', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },

  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }
});

interface PDFProps {
  invoice: Invoice;
  business: BusinessProfile;
  customer: Customer;
}

export const InvoicePDF = ({ invoice, business, customer }: PDFProps) => {
  const quote = isQuote(invoice);
  const balance = getBalance(invoice);
  const isPaid = !quote && balance <= 0;
  const history = getPaymentHistory(invoice);
  // Helvetica has no ₦ glyph, so PDFs always use the ISO code
  const money = (amount: number) => formatMoney(amount, invoice.currency, { code: true });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {isPaid && (
          <View style={styles.stampContainer}>
            <Text style={styles.stampText}>PAID FULLY</Text>
          </View>
        )}

        {/* Header with explicit left alignment */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {business.logoUrl && <Image src={business.logoUrl} style={styles.logo} />}
            <Text style={[styles.brand, { marginTop: 10 }]}>{business.businessName}</Text>
            <Text>{business.address}</Text>
            <Text>{business.phone}</Text>
            <Text>{business.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 24, fontWeight: 'light', color: '#ccc' }}>{quote ? 'QUOTATION' : 'INVOICE'}</Text>
            <Text style={{ fontSize: 12, marginTop: 4 }}>#{invoice.invoiceNumber}</Text>
            <View style={{ marginTop: 20 }}>
              <Text style={styles.label}>Date Issued</Text>
              <Text style={styles.value}>{new Date(invoice.dateIssued).toLocaleDateString()}</Text>
              {invoice.dueDate && (
                <>
                  <Text style={styles.label}>{quote ? 'Valid Until' : 'Due Date'}</Text>
                  <Text style={styles.value}>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: '#eee', marginBottom: 20 }} />

        <View style={styles.row}>
          <View style={styles.col2}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{customer.name}</Text>
            <Text>{customer.phone}</Text>
            {customer.address && <Text>{customer.address}</Text>}
            {customer.city && <Text>{customer.city}, {customer.country}</Text>}
          </View>
          <View style={styles.col2}>
            <Text style={styles.label}>Payment Instructions</Text>
            <Text style={{ fontWeight: 'bold' }}>{business.bankName}</Text>
            <Text>{business.accountNumber}</Text>
            <Text>{business.accountName}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellDesc}>Item Description</Text>
            <Text style={styles.cellQty}>Qty</Text>
            <Text style={styles.cellPrice}>Price</Text>
            <Text style={styles.cellTotal}>Total</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.cellDesc}>{item.description}</Text>
              <Text style={styles.cellQty}>{item.quantity}</Text>
              <Text style={styles.cellPrice}>{formatAmount(item.unitPrice)}</Text>
              <Text style={styles.cellTotal}>{formatAmount(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>

          {invoice.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={{ color: '#ef4444' }}>
                Discount {invoice.discountType === 'percentage' && invoice.discountRate ? `(${invoice.discountRate}%)` : ''}:
              </Text>
              <Text style={{ color: '#ef4444' }}>
                -{money(invoice.discount)}
              </Text>
            </View>
          )}

          {invoice.tax > 0 && (
            <View style={styles.totalRow}>
              <Text>{invoice.taxLabel || 'Tax'}{invoice.taxRate ? ` (${invoice.taxRate}%)` : ''}:</Text>
              <Text>{money(invoice.tax)}</Text>
            </View>
          )}

          <View style={styles.grandTotal}>
            <Text>Grand Total:</Text>
            <Text>{money(invoice.grandTotal)}</Text>
          </View>

          {!quote && history.length > 0 && (
             <View style={styles.historyTable}>
               <Text style={[styles.historyText, { fontWeight: 'bold', marginBottom: 4 }]}>Payment History:</Text>
               {history.map((pay) => (
                 <View key={pay.id} style={styles.historyRow}>
                   <Text style={styles.historyText}>
                     {new Date(pay.date).toLocaleDateString()} {pay.note ? `• ${pay.note}` : ''}
                   </Text>
                   <Text style={[styles.historyText, { color: '#22c55e' }]}>
                     {money(pay.amount)}
                   </Text>
                 </View>
               ))}
             </View>
           )}

          {!quote && (
            <>
              <View style={[styles.totalRow, { marginTop: 4 }]}>
                <Text>Total Paid:</Text>
                <Text>({money(invoice.depositAmount)})</Text>
              </View>

              <View style={[styles.totalRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 4 }]}>
                <Text style={{ fontWeight: 'bold' }}>Balance Due:</Text>
                <Text style={{ fontWeight: 'bold', color: isPaid ? '#22c55e' : '#f97316' }}>
                  {money(balance)}
                </Text>
              </View>
            </>
          )}
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.ruleBox}>
          <Text style={styles.ruleText}>
            {business.invoiceFooterText || DEFAULT_INVOICE_TERMS}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Generated by {business.businessName} • Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
};