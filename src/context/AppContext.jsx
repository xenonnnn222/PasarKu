import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTheme } from '../hooks/useTheme';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants';
import { generateSeedData } from '../data/seedData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const seed = useMemo(() => generateSeedData(), []);

  const [settings, setSettings] = useLocalStorage(
    STORAGE_KEYS.SETTINGS,
    seed.settings
  );
  const [transactions, setTransactions] = useLocalStorage(
    STORAGE_KEYS.TRANSACTIONS,
    seed.transactions
  );
  const [debts, setDebts] = useLocalStorage(STORAGE_KEYS.DEBTS, seed.debts);
  const [products, setProducts] = useLocalStorage(
    STORAGE_KEYS.PRODUCTS,
    seed.products
  );
  const [wasteLogs, setWasteLogs] = useLocalStorage(
    STORAGE_KEYS.WASTE_LOGS,
    seed.wasteLogs
  );

  // Terapkan tema dan ukuran font
  useTheme(settings?.theme || 'light', settings?.fontSize || 'normal');

  // --- AKSI PENGATURAN & AUTENTIKASI ---
  const updateSettings = useCallback(
    (partial) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [setSettings]
  );

  const completeOnboarding = useCallback(() => {
    setSettings((prev) => ({ ...prev, onboarded: true }));
  }, [setSettings]);

  const loginUser = useCallback(
    ({ phone, ownerName, businessName } = {}) => {
      setSettings((prev) => ({
        ...prev,
        phone: phone || prev.phone,
        ownerName: ownerName || prev.ownerName,
        businessName: businessName || prev.businessName,
        onboarded: true,
        loggedIn: true
      }));
    },
    [setSettings]
  );

  const logoutUser = useCallback(() => {
    setSettings((prev) => ({ ...prev, loggedIn: false }));
  }, [setSettings]);

  // --- AKSI TRANSAKSI ---
  const addTransaction = useCallback(
    (txData) => {
      const newTx = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: txData.type === 'out' ? 'out' : 'in',
        amount: Math.round(Number(txData.amount) || 0),
        category: txData.category || (txData.type === 'out' ? 'Lain-lain' : 'Penjualan'),
        note: (txData.note || '').trim(),
        date: txData.date || new Date().toISOString(),
        ...(txData.refId ? { refId: txData.refId } : {})
      };
      setTransactions((prev) => [newTx, ...prev]);
      return newTx;
    },
    [setTransactions]
  );

  const updateTransaction = useCallback(
    (id, updates) => {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === id
            ? {
                ...tx,
                ...updates,
                amount:
                  updates.amount !== undefined
                    ? Math.round(Number(updates.amount) || 0)
                    : tx.amount
              }
            : tx
        )
      );
    },
    [setTransactions]
  );

  const deleteTransaction = useCallback(
    (id) => {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    },
    [setTransactions]
  );

  // --- AKSI KASBON (PIUTANG & UTANG) ---
  const addDebt = useCallback(
    (debtData) => {
      const newDebt = {
        id: `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: debtData.type === 'utang' ? 'utang' : 'piutang',
        party: (debtData.party || 'Pelanggan').trim(),
        phone: (debtData.phone || '').trim(),
        total: Math.round(Number(debtData.total) || 0),
        paid: Math.round(Number(debtData.paid) || 0),
        dueDate: debtData.dueDate || new Date().toISOString(),
        note: (debtData.note || '').trim(),
        createdAt: debtData.createdAt || new Date().toISOString(),
        history: debtData.history || []
      };
      setDebts((prev) => [newDebt, ...prev]);
      return newDebt;
    },
    [setDebts]
  );

  const updateDebt = useCallback(
    (id, updates) => {
      setDebts((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                ...updates,
                total:
                  updates.total !== undefined
                    ? Math.round(Number(updates.total) || 0)
                    : d.total
              }
            : d
        )
      );
    },
    [setDebts]
  );

  const deleteDebt = useCallback(
    (id) => {
      setDebts((prev) => prev.filter((d) => d.id !== id));
    },
    [setDebts]
  );

  /**
   * Mencatat cicilan/pelunasan kasbon sekaligus membuat transaksi otomatis
   * - Piutang dibayar -> otomatis tambah Uang Masuk ("Bayar kasbon")
   * - Utang dibayar -> otomatis tambah Uang Keluar ("Bayar utang")
   */
  const recordDebtPayment = useCallback(
    (debtId, paymentAmount, paymentNote = '') => {
      const amount = Math.round(Number(paymentAmount) || 0);
      if (amount <= 0) return null;

      const targetDebt = debts.find((d) => d.id === debtId);
      if (!targetDebt) return null;

      const nowIso = new Date().toISOString();
      const isPiutang = targetDebt.type === 'piutang';

      const autoTx = addTransaction({
        type: isPiutang ? 'in' : 'out',
        amount,
        category: isPiutang ? 'Bayar kasbon' : 'Bayar utang',
        note:
          paymentNote.trim() ||
          `${isPiutang ? 'Cicilan kasbon' : 'Bayar utang'}: ${targetDebt.party}`,
        date: nowIso,
        refId: debtId
      });

      const historyEntry = {
        id: `hist-${Date.now()}`,
        amount,
        date: nowIso,
        note: paymentNote.trim() || 'Pembayaran cicilan',
        txId: autoTx.id
      };

      setDebts((prev) =>
        prev.map((d) => {
          if (d.id !== debtId) return d;
          const nextPaid = Math.min(d.total, (Number(d.paid) || 0) + amount);
          return {
            ...d,
            paid: nextPaid,
            history: [historyEntry, ...(d.history || [])]
          };
        })
      );

      return autoTx;
    },
    [debts, addTransaction, setDebts]
  );

  // --- AKSI STOK & BARANG ---
  const addProduct = useCallback(
    (prodData) => {
      const newProduct = {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: (prodData.name || '').trim(),
        unit: prodData.unit || 'kg',
        stock: Number(prodData.stock) || 0,
        minStock: Number(prodData.minStock) || 0,
        buyPrice: Math.round(Number(prodData.buyPrice) || 0),
        sellPrice: Math.round(Number(prodData.sellPrice) || 0)
      };
      setProducts((prev) => [newProduct, ...prev]);
      return newProduct;
    },
    [setProducts]
  );

  const updateProduct = useCallback(
    (id, updates) => {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...updates,
                stock:
                  updates.stock !== undefined
                    ? Math.max(0, Number(updates.stock) || 0)
                    : p.stock,
                minStock:
                  updates.minStock !== undefined
                    ? Math.max(0, Number(updates.minStock) || 0)
                    : p.minStock,
                buyPrice:
                  updates.buyPrice !== undefined
                    ? Math.round(Number(updates.buyPrice) || 0)
                    : p.buyPrice,
                sellPrice:
                  updates.sellPrice !== undefined
                    ? Math.round(Number(updates.sellPrice) || 0)
                    : p.sellPrice
              }
            : p
        )
      );
    },
    [setProducts]
  );

  const deleteProduct = useCallback(
    (id) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    },
    [setProducts]
  );

  const adjustProductStock = useCallback(
    (id, delta) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const nextStock = Math.max(
            0,
            Math.round(((Number(p.stock) || 0) + delta) * 100) / 100
          );
          return { ...p, stock: nextStock };
        })
      );
    },
    [setProducts]
  );

  /**
   * Tambah stok masuk dengan opsi sekaligus mencatat pengeluaran "Belanja modal"
   */
  const restockProduct = useCallback(
    ({ productId, qty, buyPrice, recordExpense }) => {
      const amountQty = Number(qty) || 0;
      if (amountQty <= 0) return;

      const target = products.find((p) => p.id === productId);
      if (!target) return;

      const unitBuyPrice =
        buyPrice !== undefined ? Math.round(Number(buyPrice)) : target.buyPrice;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                stock: Math.round(((Number(p.stock) || 0) + amountQty) * 100) / 100,
                buyPrice: unitBuyPrice
              }
            : p
        )
      );

      if (recordExpense) {
        const totalCost = Math.round(amountQty * unitBuyPrice);
        if (totalCost > 0) {
          addTransaction({
            type: 'out',
            amount: totalCost,
            category: 'Belanja modal',
            note: `Kulakan ${target.name} (${amountQty} ${target.unit})`,
            date: new Date().toISOString(),
            refId: productId
          });
        }
      }
    },
    [products, setProducts, addTransaction]
  );

  /**
   * Mencatat barang susut/busuk dan mengurangi stok barang
   */
  const recordWaste = useCallback(
    ({ productId, qty, reason }) => {
      const amountQty = Number(qty) || 0;
      if (amountQty <= 0) return null;

      const newWaste = {
        id: `waste-${Date.now()}`,
        productId,
        qty: amountQty,
        date: new Date().toISOString(),
        reason: reason || 'Busuk / Layu'
      };

      setWasteLogs((prev) => [newWaste, ...prev]);
      adjustProductStock(productId, -amountQty);
      return newWaste;
    },
    [setWasteLogs, adjustProductStock]
  );

  // --- RESET & HAPUS DATA ---
  const resetToSeedData = useCallback(() => {
    const fresh = generateSeedData();
    setSettings((prev) => ({
      ...fresh.settings,
      theme: prev.theme,
      fontSize: prev.fontSize,
      onboarded: true,
      loggedIn: true
    }));
    setProducts(fresh.products);
    setDebts(fresh.debts);
    setTransactions(fresh.transactions);
    setWasteLogs(fresh.wasteLogs);
  }, [setSettings, setProducts, setDebts, setTransactions, setWasteLogs]);

  const clearAllData = useCallback(() => {
    setTransactions([]);
    setDebts([]);
    setProducts([]);
    setWasteLogs([]);
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      businessName: prev.businessName,
      ownerName: prev.ownerName,
      phone: prev.phone,
      theme: prev.theme,
      fontSize: prev.fontSize,
      startingCash: 0,
      onboarded: true,
      loggedIn: true
    }));
  }, [setTransactions, setDebts, setProducts, setWasteLogs, setSettings]);

  const value = useMemo(
    () => ({
      settings,
      transactions,
      debts,
      products,
      wasteLogs,
      updateSettings,
      completeOnboarding,
      loginUser,
      logoutUser,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addDebt,
      updateDebt,
      deleteDebt,
      recordDebtPayment,
      addProduct,
      updateProduct,
      deleteProduct,
      adjustProductStock,
      restockProduct,
      recordWaste,
      resetToSeedData,
      clearAllData
    }),
    [
      settings,
      transactions,
      debts,
      products,
      wasteLogs,
      updateSettings,
      completeOnboarding,
      loginUser,
      logoutUser,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addDebt,
      updateDebt,
      deleteDebt,
      recordDebtPayment,
      addProduct,
      updateProduct,
      deleteProduct,
      adjustProductStock,
      restockProduct,
      recordWaste,
      resetToSeedData,
      clearAllData
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp harus digunakan di dalam AppProvider');
  }
  return context;
}

