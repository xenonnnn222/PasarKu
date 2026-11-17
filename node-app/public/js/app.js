'use strict';

// Konfirmasi sebelum menghapus atau tindakan berbahaya.
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

// Menu navigasi di layar kecil.
const menu = document.querySelector('[data-menu-toggle]');
if (menu) {
  menu.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    menu.setAttribute('aria-expanded', String(open));
  });
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.body.classList.remove('nav-open');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }
});

document.querySelectorAll('[data-print]').forEach((button) => {
  button.addEventListener('click', () => window.print());
});

// Formulir transaksi: kategori mengikuti jenis, kolom kasbon muncul bila dicentang.
const record = document.querySelector('[data-record-form]');
if (record) {
  const type = record.querySelector('[data-transaction-type]');
  const category = record.querySelector('[data-category-select]');
  const unpaid = record.querySelector('[data-unpaid-toggle]');
  const fields = record.querySelector('[data-unpaid-fields]');

  const update = () => {
    category.querySelectorAll('optgroup').forEach((group) => {
      const off = group.dataset.kind !== type.value;
      group.disabled = off;
      group.hidden = off;
    });
    const selected = category.selectedOptions[0];
    if (!selected || selected.parentElement.disabled) {
      const first = category.querySelector('optgroup:not([disabled]) option');
      if (first) category.value = first.value;
    }
    if (unpaid) {
      unpaid.disabled = type.value !== 'in';
      if (unpaid.disabled) unpaid.checked = false;
      fields.hidden = !unpaid.checked;
      fields.querySelectorAll('input').forEach((input) => {
        input.disabled = !unpaid.checked;
        input.required = unpaid.checked && input.name !== 'phone';
      });
    }
  };

  type.addEventListener('change', update);
  if (unpaid) unpaid.addEventListener('change', update);
  update();

  record.querySelectorAll('[data-add-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = record.querySelector('[data-amount]');
      const current = Math.max(0, Number(input.value) || 0);
      input.value = String(Math.min(1e12, current + Number(button.dataset.addAmount)));
      input.focus();
    });
  });
}

// Kalkulator harga jual (margin atau markup).
const calculator = document.querySelector('[data-calculator]');
if (calculator) {
  const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const calculate = () => {
    const cost = Math.max(0, Number(calculator.querySelector('[data-calc-cost]').value) || 0);
    const pct = Math.max(0, Number(calculator.querySelector('[data-calc-percent]').value) || 0);
    const margin = calculator.querySelector('[data-calc-mode]').value === 'margin';
    const raw = margin ? cost / (1 - Math.min(95, pct) / 100) : cost * (1 + pct / 100);
    const price = cost ? Math.ceil(raw / 100) * 100 : 0;
    calculator.querySelector('[data-calc-result]').textContent =
      `${currency.format(price)} / satuan · Untung ${currency.format(price - cost)}`;
  };
  calculator.addEventListener('input', calculate);
  calculator.addEventListener('change', calculate);
  calculate();
}

// Impor cadangan: dari file JSON atau dari data versi React lama (localStorage).
const importForm = document.querySelector('[data-import-form]');
if (importForm) {
  const payload = importForm.querySelector('[data-import-payload]');
  const fileInput = importForm.querySelector('[data-import-file]');
  const status = importForm.querySelector('[data-import-status]');

  importForm.addEventListener('submit', async (event) => {
    if (payload.value) return;
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      status.textContent = 'Pilih file cadangan terlebih dahulu.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      status.textContent = 'File terlalu besar (maksimal 2 MB).';
      return;
    }
    payload.value = await file.text();
    importForm.submit();
  });

  importForm.querySelector('[data-import-legacy]').addEventListener('click', () => {
    try {
      const data = {};
      let found = false;
      ['transactions', 'debts', 'products', 'wasteLogs'].forEach((key) => {
        const stored = localStorage.getItem(`pasarku:${key}`);
        if (stored !== null) found = true;
        data[key] = stored === null ? [] : JSON.parse(stored);
      });
      const raw = localStorage.getItem('pasarku:settings');
      if (raw !== null) found = true;
      const settings = raw ? JSON.parse(raw) : {};
      data.settings = {};
      ['startingCash', 'theme', 'fontSize'].forEach((key) => {
        if (settings[key] !== undefined) data.settings[key] = settings[key];
      });

      if (!found) {
        status.textContent = 'Tidak ada data versi lama di browser ini. Gunakan file cadangan jika data ada di perangkat lain.';
        return;
      }
      if (!window.confirm('Impor data pembukuan dari browser ini ke akun yang sedang masuk?')) return;
      payload.value = JSON.stringify(data);
      importForm.submit();
    } catch {
      status.textContent = 'Data browser tidak dapat dibaca. Ekspor cadangan dari versi lama terlebih dahulu.';
    }
  });
}
