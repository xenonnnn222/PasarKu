/**
 * Memformat angka bulat menjadi string Rupiah (contoh: Rp 25.000 atau -Rp 15.000)
 */
export function formatRupiah(amount, withPrefix = true) {
  const numeric = Math.round(Number(amount) || 0);
  const isNegative = numeric < 0;
  const absValue = Math.abs(numeric);
  const formatted = absValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!withPrefix) {
    return isNegative ? `-${formatted}` : formatted;
  }
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Memformat nominal singkat untuk sumbu grafik (contoh: 150rb, 1,2jt)
 */
export function formatCompactRupiah(amount) {
  const num = Number(amount) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toFixed(1).replace('.0', '').replace('.', ',')}jt`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000)}rb`;
  }
  return `${sign}${abs}`;
}

