<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DebtPayment extends Model
{
    protected $fillable = ['amount', 'paid_at', 'note', 'transaction_id'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'paid_at' => 'date'];
    }
}
