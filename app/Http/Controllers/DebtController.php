<?php

namespace App\Http\Controllers;

use App\Support\Bookkeeping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DebtController extends Controller
{
    public function index(Request $r)
    {
        $data = $r->validate(['q' => 'nullable|string|max:100', 'type' => ['nullable', Rule::in(['piutang', 'utang'])], 'status' => ['nullable', Rule::in(['open', 'paid', 'overdue'])]]);
        $query = $r->user()->debts()->with(['payments' => fn ($q) => $q->orderByDesc('paid_at')->orderByDesc('id')]);
        if (! empty($data['q'])) {
            $query->where('party', 'like', '%'.$data['q'].'%');
        }
        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }
        if (($data['status'] ?? '') === 'paid') {
            $query->whereColumn('paid', '>=', 'total');
        }
        if (in_array($data['status'] ?? '', ['open', 'overdue'])) {
            $query->whereColumn('paid', '<', 'total');
        }
        if (($data['status'] ?? '') === 'overdue') {
            $query->whereDate('due_date', '<', today());
        }
        $balances = $r->user()->debts()->get()->groupBy('type')->map(fn ($items) => $items->sum('remaining'));

        return view('debts', ['debts' => $query->orderBy('due_date')->paginate(12)->withQueryString(), 'balances' => $balances]);
    }

    private function data(Request $r): array
    {
        return $r->validate(['type' => ['required', Rule::in(['piutang', 'utang'])], 'party' => 'required|string|max:150', 'phone' => 'nullable|string|max:25', 'total' => 'required|integer|min:1|max:'.Bookkeeping::MAX_MONEY, 'due_date' => 'required|date_format:Y-m-d', 'note' => 'nullable|string|max:1000']);
    }

    public function store(Request $r)
    {
        $r->user()->debts()->create($this->data($r) + ['paid' => 0]);

        return back()->with('success', 'Kasbon berhasil ditambahkan.');
    }

    public function update(Request $r, string $debt)
    {
        $data = $this->data($r);
        DB::transaction(function () use ($r, $debt, $data) {
            $item = $r->user()->debts()->lockForUpdate()->findOrFail($debt);
            if ($data['total'] < $item->paid) {
                throw ValidationException::withMessages(['total' => 'Total tidak boleh lebih kecil dari pembayaran yang sudah dicatat.']);
            }
            if ($item->paid > 0 && $item->type !== $data['type']) {
                throw ValidationException::withMessages(['type' => 'Jenis kasbon yang sudah dibayar tidak dapat diganti.']);
            }
            $item->update($data);
        }, 5);

        return back()->with('success', 'Kasbon diperbarui.');
    }

    public function pay(Request $r, string $debt)
    {
        $data = $r->validate(['amount' => 'required|integer|min:1|max:'.Bookkeeping::MAX_MONEY, 'paid_at' => 'required|date_format:Y-m-d', 'note' => 'nullable|string|max:1000']);
        DB::transaction(function () use ($r, $debt, $data) {
            $item = $r->user()->debts()->lockForUpdate()->findOrFail($debt);
            if ($data['amount'] > $item->remaining) {
                throw ValidationException::withMessages(['amount' => 'Pembayaran melebihi sisa kasbon.']);
            }
            $income = $item->type === 'piutang';
            $tx = $r->user()->transactions()->create(['type' => $income ? 'in' : 'out', 'amount' => $data['amount'], 'category' => $income ? 'Bayar kasbon' : 'Bayar utang', 'note' => ($data['note'] ?? null) ?: 'Pembayaran: '.$item->party, 'occurred_on' => $data['paid_at'], 'debt_id' => $item->id, 'source' => 'debt_payment']);
            $item->payments()->create($data + ['transaction_id' => $tx->id]);
            $item->increment('paid', $data['amount']);
        }, 5);

        return back()->with('success', 'Pembayaran tersimpan dan saldo kas diperbarui.');
    }

    public function destroy(Request $r, string $debt)
    {
        DB::transaction(function () use ($r, $debt) {
            $item = $r->user()->debts()->lockForUpdate()->findOrFail($debt);
            if ($item->paid > 0) {
                throw ValidationException::withMessages(['debt' => 'Kasbon dengan pembayaran tidak dapat dihapus agar riwayat kas tetap utuh.']);
            }$item->delete();
        }, 5);

        return back()->with('success', 'Kasbon dihapus.');
    }
}
