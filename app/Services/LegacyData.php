<?php

namespace App\Services;

use App\Models\User;
use App\Support\Bookkeeping;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LegacyData
{
    public function import(User $user, array $payload): void
    {
        $payload += ['transactions' => [], 'products' => [], 'debts' => [], 'wasteLogs' => [], 'settings' => []];
        $money = 'integer|min:0|max:'.Bookkeeping::MAX_MONEY;
        $data = Validator::make($payload, [
            'settings' => 'array', 'settings.startingCash' => 'sometimes|'.$money, 'settings.theme' => ['sometimes', Rule::in(['light', 'dark'])], 'settings.fontSize' => ['sometimes', Rule::in(['normal', 'large'])],
            'transactions' => 'present|array|max:10000', 'transactions.*.id' => 'required|string|max:100|distinct', 'transactions.*.source' => ['sometimes', Rule::in(['manual', 'restock', 'debt_payment'])], 'transactions.*.type' => ['required', Rule::in(['in', 'out'])], 'transactions.*.amount' => 'required|'.$money, 'transactions.*.category' => 'required|string|max:100', 'transactions.*.note' => 'nullable|string|max:1000', 'transactions.*.date' => 'required|date',
            'products' => 'present|array|max:10000', 'products.*.id' => 'required|string|max:100|distinct', 'products.*.name' => 'required|string|max:150', 'products.*.unit' => ['required', Rule::in(Bookkeeping::UNITS)], 'products.*.stock' => 'required|numeric|min:0|max:10000000|decimal:0,2', 'products.*.minStock' => 'required|numeric|min:0|max:10000000|decimal:0,2', 'products.*.buyPrice' => 'required|'.$money, 'products.*.sellPrice' => 'required|'.$money,
            'debts' => 'present|array|max:10000', 'debts.*.id' => 'required|string|max:100|distinct', 'debts.*.type' => ['required', Rule::in(['piutang', 'utang'])], 'debts.*.party' => 'required|string|max:150', 'debts.*.phone' => 'nullable|string|max:25', 'debts.*.total' => 'required|'.$money, 'debts.*.paid' => 'required|'.$money, 'debts.*.dueDate' => 'required|date', 'debts.*.note' => 'nullable|string|max:1000', 'debts.*.history' => 'sometimes|array|max:1000', 'debts.*.history.*.amount' => 'required|integer|min:1|max:'.Bookkeeping::MAX_MONEY, 'debts.*.history.*.date' => 'required|date', 'debts.*.history.*.note' => 'nullable|string|max:1000', 'debts.*.history.*.txId' => 'nullable|string|max:100',
            'wasteLogs' => 'present|array|max:10000', 'wasteLogs.*.productId' => 'nullable|string|max:100', 'wasteLogs.*.qty' => 'required|numeric|gt:0|max:10000000|decimal:0,2', 'wasteLogs.*.date' => 'required|date', 'wasteLogs.*.reason' => 'nullable|string|max:100', 'wasteLogs.*.cost' => 'sometimes|'.$money,
        ])->validate();
        DB::transaction(function () use ($user, $data) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($user->transactions()->exists() || $user->debts()->exists() || $user->products()->exists() || $user->wasteLogs()->exists()) {
                throw ValidationException::withMessages(['import' => 'Impor hanya tersedia saat pembukuan kosong. Cadangkan dan kosongkan data akun ini terlebih dahulu.']);
            }
            $products = [];
            $debts = [];
            $transactions = [];
            foreach ($data['products'] as $p) {
                $products[$p['id']] = $user->products()->create(['name' => $p['name'], 'unit' => $p['unit'], 'stock' => $p['stock'], 'min_stock' => $p['minStock'], 'buy_price' => $p['buyPrice'], 'sell_price' => $p['sellPrice']]);
            }
            foreach ($data['debts'] as $d) {
                if ($d['paid'] > $d['total'] || collect($d['history'] ?? [])->sum('amount') > $d['paid']) {
                    throw ValidationException::withMessages(['import' => 'Jumlah pembayaran pada kasbon tidak konsisten. Data belum diimpor.']);
                }
                $debts[$d['id']] = $user->debts()->create(['type' => $d['type'], 'party' => $d['party'], 'phone' => $d['phone'] ?? null, 'total' => $d['total'], 'paid' => $d['paid'], 'due_date' => Carbon::parse($d['dueDate'])->toDateString(), 'note' => $d['note'] ?? null]);
            }
            foreach ($data['transactions'] as $tx) {
                $transactions[$tx['id']] = $user->transactions()->create(['type' => $tx['type'], 'amount' => $tx['amount'], 'category' => $tx['category'], 'note' => $tx['note'] ?? null, 'occurred_on' => Carbon::parse($tx['date'])->toDateString(), 'source' => ($tx['source'] ?? 'manual') === 'restock' ? 'restock' : 'manual']);
            }
            $usedTransactions = [];
            foreach ($data['debts'] as $d) {
                foreach ($d['history'] ?? [] as $payment) {
                    $tx = $transactions[$payment['txId'] ?? ''] ?? null;
                    if ($tx) {
                        if (isset($usedTransactions[$tx->id]) || $tx->amount !== (int) $payment['amount'] || $tx->type !== ($d['type'] === 'piutang' ? 'in' : 'out')) {
                            throw ValidationException::withMessages(['import' => 'Referensi transaksi pembayaran tidak konsisten.']);
                        }
                        $usedTransactions[$tx->id] = true;
                        $tx->update(['debt_id' => $debts[$d['id']]->id, 'source' => 'debt_payment']);
                    }
                    $debts[$d['id']]->payments()->create(['amount' => $payment['amount'], 'paid_at' => Carbon::parse($payment['date'])->toDateString(), 'note' => $payment['note'] ?? null, 'transaction_id' => $tx?->id]);
                }
            }
            foreach ($data['wasteLogs'] as $w) {
                $product = $products[$w['productId'] ?? ''] ?? null;
                $cost = $w['cost'] ?? round($w['qty'] * ($product?->buy_price ?? 0));
                if ($cost > Bookkeeping::MAX_MONEY) {
                    throw ValidationException::withMessages(['import' => 'Nilai barang susut terlalu besar.']);
                }
                $user->wasteLogs()->create(['product_id' => $product?->id, 'qty' => $w['qty'], 'reason' => $w['reason'] ?? 'Lainnya', 'cost' => (int) $cost, 'occurred_on' => Carbon::parse($w['date'])->toDateString()]);
            }
            $settings = $data['settings'];
            $user->update(['starting_cash' => $settings['startingCash'] ?? $user->starting_cash, 'theme' => $settings['theme'] ?? $user->theme, 'font_size' => $settings['fontSize'] ?? $user->font_size]);
        }, 5);
    }

    public function export(User $user): array
    {
        return [
            'schemaVersion' => 2,
            'settings' => ['startingCash' => $user->starting_cash, 'theme' => $user->theme, 'fontSize' => $user->font_size],
            'transactions' => $user->transactions()->get()->map(fn ($t) => ['id' => 'tx-'.$t->id, 'source' => $t->source, 'type' => $t->type, 'amount' => $t->amount, 'category' => $t->category, 'note' => $t->note, 'date' => $t->occurred_on->toDateString()])->all(),
            'products' => $user->products()->get()->map(fn ($p) => ['id' => 'prod-'.$p->id, 'name' => $p->name, 'unit' => $p->unit, 'stock' => (float) $p->stock, 'minStock' => (float) $p->min_stock, 'buyPrice' => $p->buy_price, 'sellPrice' => $p->sell_price])->all(),
            'debts' => $user->debts()->with('payments')->get()->map(fn ($d) => ['id' => 'debt-'.$d->id, 'type' => $d->type, 'party' => $d->party, 'phone' => $d->phone, 'total' => $d->total, 'paid' => $d->paid, 'dueDate' => $d->due_date->toDateString(), 'note' => $d->note, 'history' => $d->payments->map(fn ($p) => ['amount' => $p->amount, 'date' => $p->paid_at->toDateString(), 'note' => $p->note, 'txId' => $p->transaction_id ? 'tx-'.$p->transaction_id : null])->all()])->all(),
            'wasteLogs' => $user->wasteLogs()->get()->map(fn ($w) => ['productId' => $w->product_id ? 'prod-'.$w->product_id : null, 'qty' => (float) $w->qty, 'reason' => $w->reason, 'date' => $w->occurred_on->toDateString(), 'cost' => $w->cost])->all(),
        ];
    }
}
