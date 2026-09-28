import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Invoice, BusinessProfile, Customer } from '../../types';
import type { ReceiptInfo } from '../../lib/invoice';
import { formatMoney } from '../../lib/currency';
import { pdfTheme } from '../../lib/color';

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  logo: { width: 60, height: 'auto', marginBottom: 6 },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 18, color: '#999', textAlign: 'right' },
  label: { fontSize: 8, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 10, marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  amountBox: { marginVertical: 12, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 6, alignItems: 'center' },
  amount: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#15803D' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  paidStamp: { marginTop: 12, alignSelf: 'center', borderWidth: 2, borderColor: '#15803D', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4, color: '#15803D', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, textAlign: 'center', fontSize: 8, color: '#999' },
});

interface ReceiptPDFProps {
  invoice: Invoice;
  receipt: ReceiptInfo;
  business: BusinessProfile;
  customer: Customer;
}

export const ReceiptPDF = ({ invoice, receipt, business, customer }: ReceiptPDFProps) => {
  // Helvetica has no ₦ glyph, so PDFs always use the ISO code
  const money = (amount: number) => formatMoney(amount, invoice.currency, { code: true });

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            {business.logoUrl && <Image src={business.logoUrl} style={styles.logo} />}
            <Text style={[styles.brand, { color: pdfTheme(business).accent }]}>{business.businessName}</Text>
            <Text>{business.phone}</Text>
            {business.email && <Text>{business.email}</Text>}
          </View>
          <View>
            <Text style={styles.title}>RECEIPT</Text>
            <Text style={{ textAlign: 'right', marginTop: 2 }}>#{receipt.receiptNumber}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Received From</Text>
            <Text style={styles.value}>{customer.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Payment Date</Text>
            <Text style={styles.value}>{new Date(receipt.payment.date).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.label}>Amount Received</Text>
          <Text style={styles.amount}>{money(receipt.payment.amount)}</Text>
          {receipt.payment.note && <Text style={{ marginTop: 4, color: '#666' }}>{receipt.payment.note}</Text>}
        </View>

        <View style={styles.row}>
          <Text>For Invoice</Text>
          <Text>#{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text>Invoice Total</Text>
          <Text>{money(invoice.grandTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Total Paid to Date</Text>
          <Text>{money(receipt.paidToDate)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#eee' }]}>
          <Text style={styles.bold}>Balance Remaining</Text>
          <Text style={[styles.bold, { color: receipt.balanceAfter > 0 ? '#EA580C' : '#15803D' }]}>{money(receipt.balanceAfter)}</Text>
        </View>

        {receipt.balanceAfter <= 0 && <Text style={styles.paidStamp}>PAID IN FULL</Text>}

        <Text style={styles.footer}>Thank you for your payment. • {business.businessName}</Text>
      </Page>
    </Document>
  );
};
