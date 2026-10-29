<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    protected $fillable = ['type', 'amount', 'category', 'note', 'occurred_on', 'debt_id', 'source'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'occurred_on' => 'date'];
    }
}
