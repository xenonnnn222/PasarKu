<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\UserRole;
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
        'role' => 'pemilik',
    ];

    /** role dan disabled_at sengaja tidak fillable: hanya diubah lewat AdminController / artisan. */
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
            'role' => UserRole::class,
            'disabled_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin && ! $this->is_demo;
    }

    public function isDisabled(): bool
    {
        return $this->disabled_at !== null;
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
