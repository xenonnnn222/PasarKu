<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $fillable = ['type', 'party', 'phone', 'total', 'paid', 'due_date', 'note'];

    protected function casts(): array
    {
        return ['total' => 'integer', 'paid' => 'integer', 'due_date' => 'date'];
    }

    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    public function getRemainingAttribute(): int
    {
        return max(0, $this->total - $this->paid);
    }

    public function getStatusAttribute(): string
    {
        return $this->remaining === 0 ? 'Lunas' : ($this->due_date->lt(today()) ? 'Terlambat' : 'Belum lunas');
    }
}
