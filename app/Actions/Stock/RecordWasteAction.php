<?php

declare(strict_types=1);

namespace App\Actions\Stock;

use App\Models\User;
use App\Support\Bookkeeping;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordWasteAction
{
    /**
     * @param  array{qty: float|int|string, reason: string}  $data
     */
    public function execute(User $user, string $productId, array $data): void
    {
        DB::transaction(function () use ($user, $productId, $data): void {
            $item = $user->products()->lockForUpdate()->findOrFail($productId);

            if ((float) $data['qty'] > (float) $item->stock) {
                throw ValidationException::withMessages([
                    'qty' => 'Barang susut melebihi stok tersedia.',
                ]);
            }

            $cost = round((float) $data['qty'] * $item->buy_price);

            if ($cost > Bookkeeping::MAX_MONEY) {
                throw ValidationException::withMessages([
                    'qty' => 'Nilai barang susut terlalu besar.',
                ]);
            }

            $user->wasteLogs()->create($data + [
                'product_id' => $item->id,
                'cost' => (int) $cost,
                'occurred_on' => today(),
            ]);

            $item->update([
                'stock' => round((float) $item->stock - (float) $data['qty'], 2),
            ]);
        }, 5);
    }
}
