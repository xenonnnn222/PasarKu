import { formatShortDate } from './formatDate';

/**
 * Mengekspor daftar transaksi ke file CSV dengan UTF-8 BOM agar terbaca rapi di Microsoft Excel
 */
export function exportTransactionsToCsv(transactions = [], periodLabel = 'Semua') {
  const headers = ['Tanggal', 'Jenis', 'Kategori', 'Nominal (Rp)', 'Catatan'];

  const escapeCsvCell = (value) => {
    const str = String(value ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = transactions.map((tx) => [
    formatShortDate(tx.date),
    tx.type === 'in' ? 'Uang Masuk' : 'Uang Keluar',
    tx.category,
    Math.round(Number(tx.amount) || 0),
    tx.note || '-'
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(','))
  ].join('\r\n');

  // Tambahkan BOM UTF-8 (\uFEFF)
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `Laporan_PasarKu_${safePeriod}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

