<?php

declare(strict_types=1);

namespace App\Providers;

use App\Support\Bookkeeping;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());

        RateLimiter::for('login', fn (Request $request): array => [
            Limit::perMinute(5)->by('login:'.Bookkeeping::phone((string) $request->input('phone')).'|'.$request->ip()),
            Limit::perMinute(30)->by('login-ip:'.$request->ip()),
        ]);

        RateLimiter::for('registration', fn (Request $request): Limit => Limit::perMinute(5)->by($request->ip()));
    }
}
