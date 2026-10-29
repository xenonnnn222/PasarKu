<?php

namespace App\Providers;

use App\Support\Bookkeeping;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        RateLimiter::for('login', fn (Request $r) => [Limit::perMinute(5)->by('login:'.Bookkeeping::phone((string) $r->input('phone')).'|'.$r->ip()), Limit::perMinute(30)->by('login-ip:'.$r->ip())]);
        RateLimiter::for('registration', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));
    }
}
