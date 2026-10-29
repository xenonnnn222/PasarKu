<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $attributes = ['starting_cash' => 0, 'theme' => 'light', 'font_size' => 'normal', 'is_demo' => false];

    protected $fillable = ['name', 'business_name', 'phone', 'password', 'starting_cash', 'theme', 'font_size', 'is_demo'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'starting_cash' => 'integer', 'is_demo' => 'boolean'];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function wasteLogs(): HasMany
    {
        return $this->hasMany(WasteLog::class);
    }
}
