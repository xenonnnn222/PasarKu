<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $fillable = [
        'type',
        'party',
        'phone',
        'total',
        'paid',
        'due_date',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'integer',
            'paid' => 'integer',
            'due_date' => 'date',
        ];
    }

    /**
     * @return HasMany<DebtPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    /**
     * @return Attribute<int, never>
     */
    protected function remaining(): Attribute
    {
        return Attribute::make(
            get: fn (): int => max(0, $this->total - $this->paid),
        );
    }

    /**
     * @return Attribute<string, never>
     */
    protected function status(): Attribute
    {
        return Attribute::make(
            get: function (): string {
                if ($this->remaining === 0) {
                    return 'Lunas';
                }

                return $this->due_date->lt(today()) ? 'Terlambat' : 'Belum lunas';
            },
        );
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function whatsappPhone(): Attribute
    {
        return Attribute::make(
            get: function (): ?string {
                if (! $this->phone) {
                    return null;
                }

                $digits = preg_replace('/\D/', '', $this->phone) ?? '';
                if ($digits === '') {
                    return null;
                }

                return str_starts_with($digits, '0') ? '62'.substr($digits, 1) : $digits;
            },
        );
    }
}
