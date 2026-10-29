<?php

namespace App\Services;

use App\Models\User;

class DemoData
{
    public function populate(User $user): void
    {
        $products = [];
        foreach ([
            ['Bawang Merah Brebes', 'kg', 18, 5, 28000, 35000], ['Bawang Putih Kating', 'kg', 14, 5, 32000, 40000], ['Cabai Rawit Merah', 'kg', 2, 4, 45000, 58000], ['Cabai Merah Keriting', 'kg', 9, 3, 36000, 46000], ['Tomat Sayur Segar', 'kg', 15, 5, 10000, 14000], ['Kentang Dieng Super', 'kg', 22, 6, 14000, 18000], ['Wortel Brastagi', 'kg', 12, 4, 11000, 15000], ['Bayam Hijau Segar', 'ikat', 3, 5, 2000, 3500], ['Kangkung Akar', 'ikat', 16, 5, 2000, 3500], ['Telur Ayam Negeri', 'butir', 18, 30, 1700, 2200], ['Beras Medium Pulen', 'kg', 45, 15, 12500, 14500], ['Minyak Goreng Kemasan', 'liter', 12, 4, 15000, 17500],
        ] as $i => $row) {
            [$name,$unit,$stock,$minimum,$buy,$sell] = $row;
            $products[] = ['id' => 'prod-'.$i, 'name' => $name, 'unit' => $unit, 'stock' => $stock, 'minStock' => $minimum, 'buyPrice' => $buy, 'sellPrice' => $sell];
        }
        $transactions = [];
        for ($day = 13; $day >= 0; $day--) {
            $date = today()->subDays($day)->toDateString();
            $transactions[] = ['id' => 'sale-'.$day, 'type' => 'in', 'amount' => 420000 + ($day % 5) * 45000, 'category' => 'Penjualan', 'note' => 'Penjualan sayur dan sembako', 'date' => $date];
            $transactions[] = ['id' => 'buy-'.$day, 'type' => 'out', 'amount' => 230000 + ($day % 4) * 20000, 'category' => 'Belanja modal', 'note' => 'Kulakan dagangan pagi', 'date' => $date];
            $transactions[] = ['id' => 'fee-'.$day, 'type' => 'out', 'amount' => 10000, 'category' => 'Retribusi pasar', 'note' => 'Iuran pasar harian', 'date' => $date];
        }
        $transactions[] = ['id' => 'prive', 'type' => 'out', 'amount' => 50000, 'category' => 'Pribadi (prive)', 'note' => 'Kebutuhan rumah tangga', 'date' => today()->toDateString()];
        $transactions[] = ['id' => 'payment', 'type' => 'in', 'amount' => 85000, 'category' => 'Bayar kasbon', 'note' => 'Cicilan Bu Tejo', 'date' => today()->subDays(2)->toDateString()];
        $debts = [];
        foreach ([['piutang', 'Warung Makan Bu Tejo', '081322445566', 185000, 85000, 2], ['piutang', 'Pak RT Slamet', '081298765432', 95000, 0, -3], ['piutang', 'Warung Bu Nanik', '081234560001', 120000, 0, 4], ['utang', 'Supplier Sayur Pak Joko', '081234560002', 750000, 0, 5]] as $i => $row) {
            [$type,$party,$phone,$total,$paid,$due] = $row;
            $debts[] = ['id' => 'debt-'.$i, 'type' => $type, 'party' => $party, 'phone' => $phone, 'total' => $total, 'paid' => $paid, 'dueDate' => today()->addDays($due)->toDateString(), 'note' => 'Contoh catatan kasbon', 'history' => $i === 0 ? [['amount' => 85000, 'date' => today()->subDays(2)->toDateString(), 'note' => 'Cicilan pertama', 'txId' => 'payment']] : []];
        }
        app(LegacyData::class)->import($user, ['settings' => ['startingCash' => 500000], 'products' => $products, 'transactions' => $transactions, 'debts' => $debts, 'wasteLogs' => [['productId' => 'prod-4', 'qty' => 1.5, 'date' => today()->subDay()->toDateString(), 'reason' => 'Busuk / Layu', 'cost' => 15000]]]);
    }
}
