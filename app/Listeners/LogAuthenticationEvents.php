<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Models\User;
use App\Support\Bookkeeping;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Log;

/**
 * Didaftarkan otomatis oleh event discovery Laravel (metode handle* di app/Listeners).
 * Mencatat login, logout, dan login gagal ke storage/logs/security.log.
 * Format baris "Login gagal ... ip=X" dibaca Fail2Ban (deploy/fail2ban) untuk memblokir brute force.
 */
class LogAuthenticationEvents
{
    public function handleLogin(Login $event): void
    {
        Log::channel('security')->info('Login berhasil', $this->context($event->user));
    }

    public function handleLogout(Logout $event): void
    {
        Log::channel('security')->info('Logout', $this->context($event->user));
    }

    public function handleFailed(Failed $event): void
    {
        $phone = Bookkeeping::phone((string) ($event->credentials['phone'] ?? ''));

        Log::channel('security')->warning('Login gagal phone='.self::maskPhone($phone).' ip='.request()->ip(), [
            'user_agent' => mb_substr((string) request()->userAgent(), 0, 200),
        ]);
    }

    /** Nomor HP tidak disimpan utuh di log: 081234567890 → 0812*****890. */
    public static function maskPhone(string $phone): string
    {
        if (strlen($phone) < 8) {
            return str_repeat('*', strlen($phone));
        }

        return substr($phone, 0, 4).str_repeat('*', strlen($phone) - 7).substr($phone, -3);
    }

    /**
     * @return array<string, mixed>
     */
    private function context(?Authenticatable $user): array
    {
        return [
            'user_id' => $user?->getAuthIdentifier(),
            'demo' => $user instanceof User && $user->is_demo,
            'ip' => request()->ip(),
            'user_agent' => mb_substr((string) request()->userAgent(), 0, 200),
        ];
    }
}
