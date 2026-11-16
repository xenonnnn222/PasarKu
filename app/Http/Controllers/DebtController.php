<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Debt\DeleteDebtAction;
use App\Actions\Debt\PayDebtAction;
use App\Actions\Debt\UpdateDebtAction;
use App\Enums\DebtType;
use App\Http\Requests\Debt\PayDebtRequest;
use App\Http\Requests\Debt\SaveDebtRequest;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DebtController extends Controller
{
    public function index(Request $request): View
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(DebtType::values())],
            'status' => ['nullable', Rule::in(['open', 'paid', 'overdue'])],
        ]);

        $user = $request->user();
        $query = $user->debts()->with([
            'payments' => fn ($q) => $q->orderByDesc('paid_at')->orderByDesc('id'),
        ]);

        if (! empty($data['q'])) {
            $query->where('party', 'like', '%'.$data['q'].'%');
        }

        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }

        if (($data['status'] ?? '') === 'paid') {
            $query->whereColumn('paid', '>=', 'total');
        }

        if (in_array($data['status'] ?? '', ['open', 'overdue'], true)) {
            $query->whereColumn('paid', '<', 'total');
        }

        if (($data['status'] ?? '') === 'overdue') {
            $query->whereDate('due_date', '<', today());
        }

        $balances = $user->debts()
            ->selectRaw('type, COALESCE(SUM(CASE WHEN total > paid THEN total - paid ELSE 0 END), 0) as remaining_sum')
            ->groupBy('type')
            ->pluck('remaining_sum', 'type')
            ->map(fn (mixed $val): int => (int) $val);

        return view('debts', [
            'debts' => $query->orderBy('due_date')->paginate(12)->withQueryString(),
            'balances' => $balances,
        ]);
    }

    public function store(SaveDebtRequest $request): RedirectResponse
    {
        $request->user()->debts()->create($request->validated() + ['paid' => 0]);

        return back()->with('success', 'Kasbon berhasil ditambahkan.');
    }

    public function update(SaveDebtRequest $request, string $debt, UpdateDebtAction $action): RedirectResponse
    {
        $action->execute($request->user(), $debt, $request->validated());

        return back()->with('success', 'Kasbon diperbarui.');
    }

    public function pay(PayDebtRequest $request, string $debt, PayDebtAction $action): RedirectResponse
    {
        $action->execute($request->user(), $debt, $request->validated());

        return back()->with('success', 'Pembayaran tersimpan dan saldo kas diperbarui.');
    }

    public function destroy(Request $request, string $debt, DeleteDebtAction $action): RedirectResponse
    {
        $action->execute($request->user(), $debt);

        return back()->with('success', 'Kasbon dihapus.');
    }
}
