<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Bookkeeping;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('model:prune')->daily();

// Memberi/mencabut peran admin (checklist B6). Hanya bisa dari server:
//   php artisan pasarku:role 081234567890 admin
//   php artisan pasarku:role 081234567890 pemilik
Artisan::command('pasarku:role {phone} {role}', function (string $phone, string $role): int {
    $target = UserRole::tryFrom($role);
    if ($target === null) {
        $this->error('Peran harus salah satu dari: '.implode(', ', UserRole::values()));

        return 1;
    }

    $user = User::query()->where('phone', Bookkeeping::phone($phone))->where('is_demo', false)->first();
    if ($user === null) {
        $this->error('Akun dengan nomor itu tidak ditemukan.');

        return 1;
    }

    $from = $user->role->value;
    $user->forceFill(['role' => $target])->save();
    AuditLog::record(null, 'cli.change_role', $user, ['from' => $from, 'to' => $target->value]);
    $this->info("Peran {$user->business_name}: {$from} → {$target->value}");

    return 0;
})->purpose('Ubah peran akun PasarKu (pemilik/admin)');
