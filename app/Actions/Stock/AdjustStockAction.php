<?php

declare(strict_types=1);

namespace App\Actions\Stock;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdjustStockAction
{
    public function execute(User $user, string $productId, float|int $delta): void
    {
        DB::transaction(function () use ($user, $productId, $delta): void {
            $item = $user->products()->lockForUpdate()->findOrFail($productId);
            $stock = round((float) $item->stock + (float) $delta, 2);

            if ($stock < 0) {
                throw ValidationException::withMessages([
                    'stock' => 'Stok tidak boleh negatif.',
                ]);
            }

            $item->update(['stock' => $stock]);
        }, 5);
    }
}
