<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\TransactionSource;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TransactionPolicy
{
    public function view(User $user, Transaction $transaction): Response
    {
        return $user->id === $transaction->user_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function update(User $user, Transaction $transaction): Response
    {
        if ($user->id !== $transaction->user_id) {
            return Response::denyAsNotFound();
        }

        return $transaction->source === TransactionSource::Manual->value
            ? Response::allow()
            : Response::denyWithStatus(422, 'Transaksi otomatis tidak dapat diubah langsung.');
    }

    public function delete(User $user, Transaction $transaction): Response
    {
        if ($user->id !== $transaction->user_id) {
            return Response::denyAsNotFound();
        }

        return $transaction->source === TransactionSource::Manual->value
            ? Response::allow()
            : Response::denyWithStatus(422, 'Transaksi pembayaran kasbon atau stok masuk tidak dapat dihapus langsung.');
    }
}
