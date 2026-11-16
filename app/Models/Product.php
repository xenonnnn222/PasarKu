<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'name',
        'unit',
        'stock',
        'min_stock',
        'buy_price',
        'sell_price',
    ];

    protected function casts(): array
    {
        return [
            'stock' => 'decimal:2',
            'min_stock' => 'decimal:2',
            'buy_price' => 'integer',
            'sell_price' => 'integer',
        ];
    }

    /**
     * @return Attribute<string, never>
     */
    protected function status(): Attribute
    {
        return Attribute::make(
            get: function (): string {
                if ((float) $this->stock <= 0) {
                    return 'Habis';
                }

                return (float) $this->stock <= (float) $this->min_stock ? 'Menipis' : 'Cukup';
            },
        );
    }
}
