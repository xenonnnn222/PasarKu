import { toLocalDateInputValue, formatShortDate, formatMonthYear } from './formatDate';

/**
 * Mengecek apakah kategori transaksi adalah Pribadi (prive)
 */
export function isPriveCategory(category) {
  return category === 'Pribadi (prive)';
}

/**
 * Menghitung Saldo Kas:
 * Saldo kas = modal awal + semua uang masuk - semua uang keluar (termasuk prive)
 */
export function calculateCashBalance(transactions = [], startingCash = 0) {
  const initial = Math.round(Number(startingCash) || 0);
  return transactions.reduce((acc, tx) => {
    const amt = Math.round(Number(tx.amount) || 0);
    return tx.type === 'in' ? acc + amt : acc - amt;
  }, initial);
}

/**
 * Menghitung ringkasan transaksi pada satu tanggal tertentu:
 * Untung hari ini = uang masuk hari ini - uang keluar usaha hari ini (kecuali Pribadi/Prive)
 */
export function calculateDailySummary(transactions = [], targetDate = new Date()) {
  const targetKey = toLocalDateInputValue(targetDate);
  let totalIn = 0;
  let totalOut = 0;
  let businessOut = 0;
  let priveOut = 0;

  for (const tx of transactions) {
    if (toLocalDateInputValue(tx.date) !== targetKey) continue;
    const amt = Math.round(Number(tx.amount) || 0);
    if (tx.type === 'in') {
      totalIn += amt;
    } else if (tx.type === 'out') {
      totalOut += amt;
      if (isPriveCategory(tx.category)) {
        priveOut += amt;
      } else {
        businessOut += amt;
      }
    }
  }

  return {
    totalIn,
    totalOut,
    businessOut,
    priveOut,
    profit: totalIn - businessOut
  };
}

/**
 * Membandingkan untung hari ini dengan untung kemarin
 */
export function calculateProfitComparison(transactions = [], todayDate = new Date()) {
  const today = new Date(todayDate);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const todayStats = calculateDailySummary(transactions, today);
  const yesterdayStats = calculateDailySummary(transactions, yesterday);

  const diff = todayStats.profit - yesterdayStats.profit;
  let percentage = 0;
  if (yesterdayStats.profit !== 0) {
    percentage = Math.round((diff / Math.abs(yesterdayStats.profit)) * 100);
  } else if (todayStats.profit > 0) {
    percentage = 100;
  }

  return {
    todayProfit: todayStats.profit,
    yesterdayProfit: yesterdayStats.profit,
    diff,
    percentage,
    isUp: diff >= 0
  };
}

/**
 * Menentukan status kasbon: "Lunas", "Terlambat", atau "Belum lunas"
 */
export function getDebtStatus(debt, referenceDate = new Date()) {
  const remaining = Math.max(0, (Number(debt.total) || 0) - (Number(debt.paid) || 0));
  if (remaining <= 0) return 'Lunas';

  if (debt.dueDate) {
    const todayKey = toLocalDateInputValue(referenceDate);
    const dueKey = toLocalDateInputValue(debt.dueDate);
    if (dueKey && dueKey < todayKey) {
      return 'Terlambat';
    }
  }
  return 'Belum lunas';
}

/**
 * Menghitung sisa kasbon
 */
export function getDebtRemaining(debt) {
  return Math.max(0, Math.round((Number(debt.total) || 0) - (Number(debt.paid) || 0)));
}

/**
 * Mengecek status stok barang: "Habis", "Menipis", atau "Cukup"
 */
export function getStockStatus(product) {
  const stock = Number(product.stock) || 0;
  const minStock = Number(product.minStock) || 0;
  if (stock <= 0) return 'Habis';
  if (stock <= minStock) return 'Menipis';
  return 'Cukup';
}

/**
 * Mengambil daftar barang yang stoknya menipis atau habis (stok <= minStock)
 */
export function getLowStockProducts(products = []) {
  return products.filter((p) => Number(p.stock) <= Number(p.minStock));
}

/**
 * Menghitung ringkasan nilai dan jumlah stok
 */
export function calculateStockOverview(products = []) {
  const totalTypes = products.length;
  let lowStockCount = 0;
  let totalStockValue = 0;

  for (const p of products) {
    const stock = Number(p.stock) || 0;
    const min = Number(p.minStock) || 0;
    const buyPrice = Number(p.buyPrice) || 0;
    if (stock <= min) lowStockCount += 1;
    if (stock > 0) {
      totalStockValue += Math.round(stock * buyPrice);
    }
  }

  return { totalTypes, lowStockCount, totalStockValue };
}

/**
 * Kalkulator Harga Jual (Margin vs Markup)
 * - Margin: hargaJual = modal / (1 - margin%)
 * - Markup: hargaJual = modal * (1 + markup%)
 */
export function calculateSellingPrice(buyPriceInput, percentInput, mode = 'margin') {
  const modal = Math.max(0, Math.round(Number(buyPriceInput) || 0));
  const pct = Math.max(0, Number(percentInput) || 0);

  if (modal <= 0) {
    return { sellPrice: 0, profitPerUnit: 0, effectiveMargin: 0 };
  }

  let rawSell = modal;
  if (mode === 'margin') {
    const safePct = Math.min(95, pct);
    rawSell = modal / (1 - safePct / 100);
  } else {
    rawSell = modal * (1 + pct / 100);
  }

  // Pembulatan ratusan terdekat agar mudah kembalian di pasar
  const sellPrice = Math.ceil(rawSell / 100) * 100;
  const profitPerUnit = sellPrice - modal;
  const effectiveMargin = sellPrice > 0 ? Math.round((profitPerUnit / sellPrice) * 100) : 0;

  return { sellPrice, profitPerUnit, effectiveMargin };
}

/**
 * Data grafik mini 7 hari terakhir untuk halaman Beranda
 */
export function getLast7DaysProfitData(transactions = [], refDate = new Date()) {
  const days = [];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const summary = calculateDailySummary(transactions, d);
    days.push({
      dateKey: toLocalDateInputValue(d),
      label: dayNames[d.getDay()],
      fullDate: formatShortDate(d),
      untung: summary.profit,
      masuk: summary.totalIn,
      keluar: summary.businessOut
    });
  }
  return days;
}

/**
 * Perhitungan lengkap untuk halaman Laporan berdasarkan periode (day | week | month) dan offset
 */
export function calculateReportMetrics({
  transactions = [],
  wasteLogs = [],
  products = [],
  debts = [],
  period = 'week',
  offset = 0,
  refDate = new Date()
}) {
  const base = new Date(refDate);
  base.setHours(0, 0, 0, 0);

  let startDate = new Date(base);
  let endDate = new Date(base);
  let periodLabel = '';

  if (period === 'day') {
    startDate.setDate(base.getDate() + offset);
    endDate = new Date(startDate);
    periodLabel = formatShortDate(startDate);
  } else if (period === 'week') {
    endDate.setDate(base.getDate() + offset * 7);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);
    periodLabel = `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
  } else {
    startDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    endDate = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
    periodLabel = formatMonthYear(startDate);
  }

  const startKey = toLocalDateInputValue(startDate);
  const endKey = toLocalDateInputValue(endDate);

  const periodTransactions = transactions.filter((tx) => {
    const k = toLocalDateInputValue(tx.date);
    return k >= startKey && k <= endKey;
  });

  let totalIn = 0;
  let businessOut = 0;
  let priveOut = 0;
  const expenseMap = {};
  const categoryCountMap = {};
  const dailyMap = {};

  // Inisialisasi setiap tanggal di rentang periode
  const cursor = new Date(startDate);
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  while (cursor <= endDate) {
    const key = toLocalDateInputValue(cursor);
    dailyMap[key] = {
      dateKey: key,
      label:
        period === 'month'
          ? `${cursor.getDate()}`
          : `${dayNames[cursor.getDay()]} ${cursor.getDate()}`,
      fullDate: formatShortDate(cursor),
      masuk: 0,
      keluar: 0,
      untung: 0
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const tx of periodTransactions) {
    const amt = Math.round(Number(tx.amount) || 0);
    const key = toLocalDateInputValue(tx.date);
    categoryCountMap[tx.category] = (categoryCountMap[tx.category] || 0) + 1;

    if (tx.type === 'in') {
      totalIn += amt;
      if (dailyMap[key]) dailyMap[key].masuk += amt;
    } else {
      if (isPriveCategory(tx.category)) {
        priveOut += amt;
      } else {
        businessOut += amt;
        expenseMap[tx.category] = (expenseMap[tx.category] || 0) + amt;
        if (dailyMap[key]) dailyMap[key].keluar += amt;
      }
    }
  }

  const chartData = Object.values(dailyMap).map((d) => ({
    ...d,
    untung: d.masuk - d.keluar
  }));

  // Rincian pengeluaran per kategori
  const expenseBreakdown = Object.entries(expenseMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: businessOut > 0 ? Math.round((amount / businessOut) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Kategori transaksi paling sering
  let mostFrequentCategory = '-';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categoryCountMap)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentCategory = `${cat} (${count}x)`;
    }
  }

  // Hari paling untung
  let bestDay = null;
  for (const d of chartData) {
    if (d.masuk === 0 && d.keluar === 0) continue;
    if (!bestDay || d.untung > bestDay.untung) {
      bestDay = d;
    }
  }

  // Total kerugian susut pada periode ini
  const productMap = {};
  for (const p of products) productMap[p.id] = p;

  let totalWasteLoss = 0;
  let totalWasteItems = 0;
  for (const w of wasteLogs) {
    const k = toLocalDateInputValue(w.date);
    if (k >= startKey && k <= endKey) {
      const prod = productMap[w.productId];
      const buyPrice = prod ? Number(prod.buyPrice) || 0 : Number(w.buyPrice) || 0;
      totalWasteLoss += Math.round((Number(w.qty) || 0) * buyPrice);
      totalWasteItems += 1;
    }
  }

  // Total kasbon pelanggan yang belum tertagih
  const uncollectedPiutang = debts
    .filter((d) => d.type === 'piutang')
    .reduce((sum, d) => sum + getDebtRemaining(d), 0);

  return {
    periodLabel,
    startKey,
    endKey,
    totalIn,
    businessOut,
    priveOut,
    netProfit: totalIn - businessOut,
    chartData,
    expenseBreakdown,
    mostFrequentCategory,
    bestDay,
    totalWasteLoss,
    totalWasteItems,
    uncollectedPiutang,
    periodTransactions
  };
}

