<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Peran pengguna PasarKu.
 * - Pemilik: pemilik usaha; hanya bisa melihat dan mengubah data usahanya sendiri.
 * - Admin: pengelola sistem; bisa melihat daftar akun (tanpa data keuangan) serta
 *   menonaktifkan/mengaktifkan akun pemilik. Setiap tindakan admin dicatat di audit_logs
 *   dan storage/logs/security.log. Peran admin hanya bisa diberikan lewat
 *   `php artisan pasarku:role <nomor HP> admin` di server, tidak lewat aplikasi.
 */
enum UserRole: string
{
    case Owner = 'pemilik';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Pemilik usaha',
            self::Admin => 'Admin sistem',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
