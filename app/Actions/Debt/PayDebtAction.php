<?php

declare(strict_types=1);

namespace App\Actions\Debt;

use App\Enums\DebtType;
use App\Enums\TransactionSource;
use App\Enums\TransactionType;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayDebtAction
{
    /**
     * @param  array{amount: int, paid_at: string, note?: string|null}  $data
     */
    public function execute(User $user, string $debtId, array $data): void
    {
        DB::transaction(function () use ($user, $debtId, $data): void {
            $item = $user->debts()->lockForUpdate()->findOrFail($debtId);

            if ($data['amount'] > $item->remaining) {
                throw ValidationException::withMessages([
                    'amount' => 'Pembayaran melebihi sisa kasbon.',
                ]);
            }

            $income = $item->type === DebtType::Receivable->value;

            $tx = $user->transactions()->create([
                'type' => $income ? TransactionType::In->value : TransactionType::Out->value,
                'amount' => $data['amount'],
                'category' => $income ? 'Bayar kasbon' : 'Bayar utang',
                'note' => ($data['note'] ?? null) ?: 'Pembayaran: '.$item->party,
                'occurred_on' => $data['paid_at'],
                'debt_id' => $item->id,
                'source' => TransactionSource::DebtPayment->value,
            ]);

            $item->payments()->create($data + ['transaction_id' => $tx->id]);
            $item->increment('paid', $data['amount']);
        }, 5);
    }
}
