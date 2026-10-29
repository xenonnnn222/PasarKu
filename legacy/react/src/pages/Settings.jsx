import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  RotateCcw,
  Trash2,
  LogOut,
  Info
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import SegmentedControl from '../components/SegmentedControl';
import Input from '../components/Input';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    resetToSeedData,
    clearAllData,
    logoutUser
  } = useApp();
  const { showToast } = useToast();

  const [businessName, setBusinessName] = useState(
    settings?.businessName || ''
  );
  const [ownerName, setOwnerName] = useState(settings?.ownerName || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [startingCash, setStartingCash] = useState(
    String(settings?.startingCash ?? 500000)
  );

  // Dialog konfirmasi reset & hapus 2 langkah
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [clearStep, setClearStep] = useState(0);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim()) {
      showToast('Nama usaha dan nama pemilik wajib diisi', 'error');
      return;
    }
    updateSettings({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      startingCash: Math.max(0, Math.round(Number(startingCash) || 0))
    });
    showToast('Profil usaha berhasil disimpan');
  };

  const handleLogout = () => {
    logoutUser();
    showToast('Anda telah keluar dari sesi');
    navigate('/login', { replace: true });
  };

  return (
    <PageContainer
      title="Pengaturan & Profil Usaha"
      subtitle="Kelola identitas lapak, modal awal, preferensi tampilan, dan data aplikasi"
    >
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (7 Kolom): Profil Usaha */}
        <Card className="col-span-12 lg:col-span-7 p-6">
          <SectionHeader
            title="Profil Usaha"
            subtitle="Data lapak dan modal kas awal yang menjadi dasar perhitungan Saldo Kas"
          />
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input
              label="Nama Usaha / Lapak"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <Input
              label="Nama Pemilik"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
            <Input
              label="Nomor HP / WhatsApp"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Modal Kas Awal (Rp)"
              type="text"
              inputMode="numeric"
              prefix="Rp"
              formatCurrency
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              helperText="Saldo Kas = Modal Awal + Semua Uang Masuk - Semua Uang Keluar"
            />
            <Button type="submit" size="lg">
              <Save className="w-5 h-5" />
              <span>Simpan Perubahan Profil</span>
            </Button>
          </form>
        </Card>

        {/* Kolom Kanan (5 Kolom): Tampilan, Data & Tentang */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card className="p-6 space-y-4">
            <SectionHeader
              title="Tampilan & Aksesibilitas"
              subtitle="Sesuaikan mode warna dan ukuran teks dashboard"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Tema Warna
              </label>
              <SegmentedControl
                value={settings?.theme || 'light'}
                onChange={(val) => updateSettings({ theme: val })}
                options={[
                  { value: 'light', label: 'Terang' },
                  { value: 'dark', label: 'Gelap' },
                  { value: 'system', label: 'Ikuti Sistem' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Ukuran Huruf
              </label>
              <SegmentedControl
                value={settings?.fontSize || 'normal'}
                onChange={(val) => updateSettings({ fontSize: val })}
                options={[
                  { value: 'normal', label: 'Normal (16px)' },
                  { value: 'besar', label: 'Besar (18px)' }
                ]}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <SectionHeader
              title="Pengelolaan Data"
              subtitle="Kembalikan data contoh atau bersihkan seluruh catatan"
            />
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="w-5 h-5 text-primary-600" />
              <span>Reset ke Data Contoh (Bu Sari)</span>
            </Button>
            <Button
              variant="outlineDanger"
              fullWidth
              onClick={() => setClearStep(1)}
            >
              <Trash2 className="w-5 h-5" />
              <span>Hapus Semua Data</span>
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
                  PasarKu v2.0 (Desktop-First Dashboard)
                </p>
                <p>
                  Aplikasi web ini berjalan 100% di browser Anda (penyimpanan LocalStorage) tanpa memerlukan server eksternal.
                </p>
              </div>
            </div>
            <Button variant="secondary" fullWidth onClick={handleLogout}>
              <LogOut className="w-5 h-5 text-status-danger" />
              <span className="text-status-danger">Keluar dari Akun</span>
            </Button>
          </Card>
        </div>
      </div>

      {/* Dialog Konfirmasi Reset ke Data Contoh */}
      <ConfirmDialog
        isOpen={confirmResetOpen}
        variant="warning"
        title="Reset ke Data Contoh?"
        message="Seluruh transaksi, kasbon, dan stok akan dikembalikan ke data awal Lapak Sayur Bu Sari."
        confirmLabel="Ya, Reset Data"
        onConfirm={() => {
          resetToSeedData();
          setBusinessName('Lapak Sayur Bu Sari');
          setOwnerName('Bu Sari');
          setPhone('081234567890');
          setStartingCash('500000');
          setConfirmResetOpen(false);
          showToast('Data berhasil dikembalikan ke data contoh Bu Sari');
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />

      {/* Dialog Konfirmasi Hapus Semua Data - Langkah 1 */}
      <ConfirmDialog
        isOpen={clearStep === 1}
        variant="danger"
        title="Hapus Semua Data? (Langkah 1/2)"
        message="Semua catatan uang masuk, uang keluar, kasbon, dan stok barang akan dikosongkan."
        confirmLabel="Lanjut Hapus"
        onConfirm={() => setClearStep(2)}
        onCancel={() => setClearStep(0)}
      />

      {/* Dialog Konfirmasi Hapus Semua Data - Langkah 2 */}
      <ConfirmDialog
        isOpen={clearStep === 2}
        variant="danger"
        title="Yakin Hapus Permanen? (Langkah 2/2)"
        message="Tindakan ini tidak dapat dibatalkan. Semua data Anda akan menjadi kosong (Rp 0)."
        confirmLabel="Ya, Hapus Semua"
        onConfirm={() => {
          clearAllData();
          setStartingCash('0');
          setClearStep(0);
          showToast('Seluruh data berhasil dikosongkan');
        }}
        onCancel={() => setClearStep(0)}
      />
    </PageContainer>
  );
}
