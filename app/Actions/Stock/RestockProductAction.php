<?php

declare(strict_types=1);

namespace App\Actions\Stock;

use App\Enums\TransactionSource;
use App\Enums\TransactionType;
use App\Models\User;
use App\Support\Bookkeeping;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestockProductAction
{
    /**
     * @param  array{qty: float|int|string, buy_price: int}  $data
     */
    public function execute(User $user, string $productId, array $data, bool $recordExpense): void
    {
        DB::transaction(function () use ($user, $productId, $data, $recordExpense): void {
            $item = $user->products()->lockForUpdate()->findOrFail($productId);
            $stock = round((float) $item->stock + (float) $data['qty'], 2);
            $cost = round((float) $data['qty'] * (int) $data['buy_price']);

            if ($stock > 10000000 || $cost > Bookkeeping::MAX_MONEY) {
                throw ValidationException::withMessages([
                    'qty' => 'Jumlah stok atau nilai pembelian terlalu besar.',
                ]);
            }

            $item->update([
                'stock' => $stock,
                'buy_price' => $data['buy_price'],
            ]);

            if ($recordExpense && $cost > 0) {
                $user->transactions()->create([
                    'type' => TransactionType::Out->value,
                    'amount' => (int) $cost,
                    'category' => 'Belanja modal',
                    'note' => 'Kulakan '.$item->name.' ('.$data['qty'].' '.$item->unit.')',
                    'occurred_on' => today(),
                    'source' => TransactionSource::Restock->value,
                ]);
            }
        }, 5);
    }
}
