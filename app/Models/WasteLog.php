<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WasteLog extends Model
{
    protected $fillable = ['product_id', 'qty', 'reason', 'cost', 'occurred_on'];

    protected function casts(): array
    {
        return ['qty' => 'decimal:2', 'cost' => 'integer', 'occurred_on' => 'date'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
