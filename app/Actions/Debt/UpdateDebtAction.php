<?php

declare(strict_types=1);

namespace App\Actions\Debt;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateDebtAction
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, string $debtId, array $data): void
    {
        DB::transaction(function () use ($user, $debtId, $data): void {
            $item = $user->debts()->lockForUpdate()->findOrFail($debtId);

            if ($data['total'] < $item->paid) {
                throw ValidationException::withMessages([
                    'total' => 'Total tidak boleh lebih kecil dari pembayaran yang sudah dicatat.',
                ]);
            }

            if ($item->paid > 0 && $item->type !== $data['type']) {
                throw ValidationException::withMessages([
                    'type' => 'Jenis kasbon yang sudah dibayar tidak dapat diganti.',
                ]);
            }

            $item->update($data);
        }, 5);
    }
}
