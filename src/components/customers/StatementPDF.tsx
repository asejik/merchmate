import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { BusinessProfile, Customer } from '../../types';
import type { StatementGroup } from '../../lib/statement';
import { formatAmount, formatMoney } from '../../lib/currency';
import { pdfTheme } from '../../lib/color';
import { formatDate } from '../../lib/dates';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontFamily: 'Helvetica', fontSize: 9, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  logo: { width: 70, height: 'auto', marginBottom: 6 },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 20, color: '#999', textAlign: 'right' },
  label: { fontSize: 8, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  section: { marginTop: 18 },
  currencyTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  tableHeader: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6 },
  row: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cNum: { width: '16%' },
  cDate: { width: '14%' },
  cDue: { width: '14%' },
  cAmt: { width: '14%', textAlign: 'right' },
  cStatus: { width: '14%', textAlign: 'right', textTransform: 'capitalize' },
  summary: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  summaryItem: { alignItems: 'flex-end' },
  summaryValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999' },
});

interface Props {
  business: BusinessProfile;
  customer: Customer;
  groups: StatementGroup[];
  generatedOn: Date;
}

export const StatementPDF = ({ business, customer, groups, generatedOn }: Props) => {
  const theme = pdfTheme(business);
  const day = (date?: Date) => (date ? formatDate(date, business.dateFormat) : '—');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {business.logoUrl && <Image src={business.logoUrl} style={styles.logo} />}
            <Text style={[styles.brand, { color: theme.accent }]}>{business.businessName}</Text>
            <Text>{business.phone}</Text>
            {business.email && <Text>{business.email}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>STATEMENT</Text>
            <Text style={{ marginTop: 4 }}>As of {formatDate(generatedOn, business.dateFormat, { moment: true })}</Text>
          </View>
        </View>

        <Text style={styles.label}>Statement For</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>{customer.name}</Text>
        <Text>{customer.phone}</Text>

        {groups.length === 0 && <Text style={{ marginTop: 24, color: '#666' }}>No invoices for this client yet.</Text>}

        {groups.map(group => (
          <View key={group.currency} style={styles.section} wrap>
            {groups.length > 1 && <Text style={styles.currencyTitle}>{group.currency}</Text>}
            <View style={[styles.tableHeader, { backgroundColor: theme.tint }]} fixed>
              <Text style={styles.cNum}>Invoice</Text>
              <Text style={styles.cDate}>Date</Text>
              <Text style={styles.cDue}>Due</Text>
              <Text style={styles.cAmt}>Total</Text>
              <Text style={styles.cAmt}>Paid</Text>
              <Text style={styles.cAmt}>Balance</Text>
              <Text style={styles.cStatus}>Status</Text>
            </View>
            {group.rows.map(row => (
              <View key={row.invoiceNumber} style={styles.row} wrap={false}>
                <Text style={styles.cNum}>#{row.invoiceNumber}</Text>
                <Text style={styles.cDate}>{day(row.dateIssued)}</Text>
                <Text style={styles.cDue}>{day(row.dueDate)}</Text>
                <Text style={styles.cAmt}>{formatAmount(row.total)}</Text>
                <Text style={styles.cAmt}>{formatAmount(row.paid)}</Text>
                <Text style={styles.cAmt}>{formatAmount(row.balance)}</Text>
                <Text style={[styles.cStatus, { color: row.status === 'overdue' ? '#DC2626' : row.status === 'paid' ? '#15803D' : '#333' }]}>{row.status}</Text>
              </View>
            ))}
            <View style={styles.summary} wrap={false}>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>Invoiced</Text>
                <Text>{formatMoney(group.invoiced, group.currency, { code: true })}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>Paid</Text>
                <Text>{formatMoney(group.paid, group.currency, { code: true })}</Text>
              </View>
              {group.overdue > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.label, { color: '#DC2626' }]}>Overdue</Text>
                  <Text style={{ color: '#DC2626' }}>{formatMoney(group.overdue, group.currency, { code: true })}</Text>
                </View>
              )}
              <View style={styles.summaryItem}>
                <Text style={styles.label}>Balance Due</Text>
                <Text style={[styles.summaryValue, { color: theme.accent }]}>{formatMoney(group.balance, group.currency, { code: true })}</Text>
              </View>
            </View>
          </View>
        ))}

        {groups.some(g => g.balance > 0) && business.bankName && (
          <View style={{ marginTop: 24 }} wrap={false}>
            <Text style={styles.label}>Payment Details</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{business.bankName}</Text>
            <Text>{business.accountNumber}</Text>
            <Text>{business.accountName}</Text>
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${business.businessName} • Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
