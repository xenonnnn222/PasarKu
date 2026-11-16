<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;
    use MassPrunable;

    protected $attributes = [
        'starting_cash' => 0,
        'theme' => 'light',
        'font_size' => 'normal',
        'is_demo' => false,
    ];

    protected $fillable = [
        'name',
        'business_name',
        'phone',
        'password',
        'starting_cash',
        'theme',
        'font_size',
        'is_demo',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'starting_cash' => 'integer',
            'is_demo' => 'boolean',
        ];
    }

    /**
     * Prune abandoned demo accounts older than 24 hours.
     *
     * @return Builder<self>
     */
    public function prunable(): Builder
    {
        return static::query()
            ->where('is_demo', true)
            ->where('created_at', '<=', now()->subDay());
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasMany<Debt, $this>
     */
    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    /**
     * @return HasMany<Product, $this>
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * @return HasMany<WasteLog, $this>
     */
    public function wasteLogs(): HasMany
    {
        return $this->hasMany(WasteLog::class);
    }
}
