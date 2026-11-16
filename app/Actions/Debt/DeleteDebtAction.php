<?php

declare(strict_types=1);

namespace App\Actions\Debt;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeleteDebtAction
{
    public function execute(User $user, string $debtId): void
    {
        DB::transaction(function () use ($user, $debtId): void {
            $item = $user->debts()->lockForUpdate()->findOrFail($debtId);

            if ($item->paid > 0) {
                throw ValidationException::withMessages([
                    'debt' => 'Kasbon dengan pembayaran tidak dapat dihapus agar riwayat kas tetap utuh.',
                ]);
            }

            $item->delete();
        }, 5);
    }
}
