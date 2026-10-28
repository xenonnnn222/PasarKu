const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];
const MONTHS_FULL_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Mengembalikan tanggal lokal format YYYY-MM-DD untuk input[type="date"]
 */
export function toLocalDateInputValue(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format lengkap Indonesia: "Kamis, 29 Okt 2026"
 */
export function formatFullDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '-';
  const dayName = DAYS_ID[d.getDay()];
  const day = d.getDate();
  const month = MONTHS_SHORT_ID[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format tanggal ringkas: "29 Okt 2026"
 */
export function formatShortDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format nama hari + tanggal pendek untuk grafik: "Kam, 29 Okt"
 */
export function formatDayShort(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '-';
  const dayShort = DAYS_ID[d.getDay()].slice(0, 3);
  return `${dayShort}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]}`;
}

/**
 * Format bulan & tahun: "Oktober 2026"
 */
export function formatMonthYear(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '-';
  return `${MONTHS_FULL_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Mengecek apakah dua tanggal berada di hari kalender lokal yang sama
 */
export function isSameLocalDay(dateA, dateB) {
  return toLocalDateInputValue(dateA) === toLocalDateInputValue(dateB);
}

