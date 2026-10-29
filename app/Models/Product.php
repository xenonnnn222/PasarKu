<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['name', 'unit', 'stock', 'min_stock', 'buy_price', 'sell_price'];

    protected function casts(): array
    {
        return ['stock' => 'decimal:2', 'min_stock' => 'decimal:2', 'buy_price' => 'integer', 'sell_price' => 'integer'];
    }

    public function getStatusAttribute(): string
    {
        return $this->stock <= 0 ? 'Habis' : ($this->stock <= $this->min_stock ? 'Menipis' : 'Cukup');
    }
}
