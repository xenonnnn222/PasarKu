<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\DebtType;
use App\Enums\TransactionType;
use App\Http\Requests\Transaction\SaveTransactionRequest;
use App\Models\Transaction;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    public function create(Request $request): View
    {
        return view('record', [
            'transaction' => null,
            'type' => $request->query('type') === TransactionType::Out->value
                ? TransactionType::Out->value
                : TransactionType::In->value,
        ]);
    }

    public function index(Request $request): View
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(TransactionType::values())],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'sort' => ['nullable', Rule::in(['newest', 'oldest', 'largest', 'smallest'])],
        ]);

        $query = $request->user()->transactions();

        if (! empty($data['q'])) {
            $query->where(fn ($q) => $q
                ->where('note', 'like', '%'.$data['q'].'%')
                ->orWhere('category', 'like', '%'.$data['q'].'%'));
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

        [$column, $direction] = match ($data['sort'] ?? 'newest') {
            'oldest' => ['occurred_on', 'asc'],
            'largest' => ['amount', 'desc'],
            'smallest' => ['amount', 'asc'],
            default => ['occurred_on', 'desc'],
        };

        return view('history', [
            'transactions' => $query
                ->orderBy($column, $direction)
                ->orderByDesc('id')
                ->paginate(15)
                ->withQueryString(),
        ]);
    }

    public function store(SaveTransactionRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($request->boolean('unpaid')) {
            abort_unless($data['type'] === TransactionType::In->value, 422, 'Kasbon hanya dapat dicatat sebagai piutang.');

            $debt = $request->validate([
                'party' => ['required', 'string', 'max:150'],
                'phone' => ['nullable', 'string', 'max:25'],
                'due_date' => ['required', 'date_format:Y-m-d'],
            ]);

            $request->user()->debts()->create([
                ...$debt,
                'type' => DebtType::Receivable->value,
                'total' => $data['amount'],
                'paid' => 0,
                'note' => $data['note'] ?? 'Kasbon penjualan',
            ]);

            return redirect()
                ->route('debts.index')
                ->with('success', 'Kasbon dicatat. Saldo bertambah setelah pelanggan membayar.');
        }

        $request->user()->transactions()->create($data);

        return redirect()
            ->route('transactions.index')
            ->with('success', 'Transaksi berhasil dicatat.');
    }

    public function edit(string $transaction): View
    {
        $tx = Transaction::query()->findOrFail($transaction);
        Gate::authorize('update', $tx);

        return view('record', [
            'transaction' => $tx,
            'type' => $tx->type,
        ]);
    }

    public function update(SaveTransactionRequest $request, string $transaction): RedirectResponse
    {
        $tx = Transaction::query()->findOrFail($transaction);
        Gate::authorize('update', $tx);

        $tx->update($request->validated());

        return redirect()
            ->route('transactions.index')
            ->with('success', 'Transaksi diperbarui.');
    }

    public function destroy(string $transaction): RedirectResponse
    {
        $tx = Transaction::query()->findOrFail($transaction);
        Gate::authorize('delete', $tx);

        $tx->delete();

        return back()->with('success', 'Transaksi dihapus.');
    }
}
