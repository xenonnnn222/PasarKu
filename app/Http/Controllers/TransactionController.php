<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Support\Bookkeeping;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    public function create(Request $r)
    {
        return view('record', ['transaction' => null, 'type' => $r->query('type') === 'out' ? 'out' : 'in']);
    }

    public function index(Request $r)
    {
        $data = $r->validate(['q' => 'nullable|string|max:100', 'type' => ['nullable', Rule::in(['in', 'out'])], 'from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d|after_or_equal:from', 'sort' => ['nullable', Rule::in(['newest', 'oldest', 'largest', 'smallest'])]]);
        $query = $r->user()->transactions();
        if (! empty($data['q'])) {
            $query->where(fn ($q) => $q->where('note', 'like', '%'.$data['q'].'%')->orWhere('category', 'like', '%'.$data['q'].'%'));
        }
        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }
        if (! empty($data['from'])) {
            $query->whereDate('occurred_on', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->whereDate('occurred_on', '<=', $data['to']);
        }
        [$column,$direction] = match ($data['sort'] ?? 'newest') {
            'oldest' => ['occurred_on', 'asc'],'largest' => ['amount', 'desc'],'smallest' => ['amount', 'asc'],default => ['occurred_on', 'desc']
        };

        return view('history', ['transactions' => $query->orderBy($column, $direction)->orderByDesc('id')->paginate(15)->withQueryString()]);
    }

    private function validated(Request $r): array
    {
        return $r->validate(['type' => ['required', Rule::in(['in', 'out'])], 'amount' => 'required|integer|min:1|max:'.Bookkeeping::MAX_MONEY, 'category' => ['required', Rule::in($r->input('type') === 'in' ? Bookkeeping::INCOME : Bookkeeping::EXPENSE)], 'note' => 'nullable|string|max:1000', 'occurred_on' => 'required|date_format:Y-m-d']);
    }

    public function store(Request $r)
    {
        $data = $this->validated($r);
        if ($r->boolean('unpaid')) {
            abort_unless($data['type'] === 'in', 422, 'Kasbon hanya dapat dicatat sebagai piutang.');
            $debt = $r->validate(['party' => 'required|string|max:150', 'phone' => 'nullable|string|max:25', 'due_date' => 'required|date_format:Y-m-d']);
            $r->user()->debts()->create([...$debt, 'type' => 'piutang', 'total' => $data['amount'], 'paid' => 0, 'note' => $data['note'] ?? 'Kasbon penjualan']);

            return redirect()->route('debts.index')->with('success', 'Kasbon dicatat. Saldo bertambah setelah pelanggan membayar.');
        }
        $r->user()->transactions()->create($data);

        return redirect()->route('transactions.index')->with('success', 'Transaksi berhasil dicatat.');
    }

    private function owned(Request $r, string $id): Transaction
    {
        return $r->user()->transactions()->findOrFail($id);
    }

    public function edit(Request $r, string $transaction)
    {
        $tx = $this->owned($r, $transaction);
        abort_unless($tx->source === 'manual', 422, 'Transaksi otomatis tidak dapat diubah langsung.');

        return view('record', ['transaction' => $tx, 'type' => $tx->type]);
    }

    public function update(Request $r, string $transaction)
    {
        $tx = $this->owned($r, $transaction);
        abort_unless($tx->source === 'manual', 422);
        $tx->update($this->validated($r));

        return redirect()->route('transactions.index')->with('success', 'Transaksi diperbarui.');
    }

    public function destroy(Request $r, string $transaction)
    {
        $tx = $this->owned($r, $transaction);
        abort_unless($tx->source === 'manual', 422, 'Transaksi pembayaran kasbon atau stok masuk tidak dapat dihapus langsung.');
        $tx->delete();

        return back()->with('success', 'Transaksi dihapus.');
    }
}
