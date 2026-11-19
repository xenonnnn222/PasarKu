<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Listeners\LogAuthenticationEvents;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Panel admin sistem (checklist B6, G3). Hanya untuk peran admin (Gate 'admin').
 * Admin TIDAK bisa melihat data keuangan pemilik usaha; hanya identitas akun dan statusnya.
 * Setiap tindakan, termasuk membuka panel, dicatat lewat AuditLog::record().
 */
class AdminController extends Controller
{
    public function index(Request $request): View
    {
        $search = mb_substr(trim((string) $request->query('q', '')), 0, 100);

        AuditLog::record($request->user(), 'admin.view_accounts', null, $search !== '' ? ['q' => $search] : []);

        $accounts = User::query()
            ->where('is_demo', false)
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('name', 'like', '%'.$search.'%')
                        ->orWhere('business_name', 'like', '%'.$search.'%');
                });
            })
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        $logs = AuditLog::query()->with(['actor:id,name', 'target:id,name'])->latest('id')->limit(20)->get();

        return view('admin', [
            'accounts' => $accounts,
            'logs' => $logs,
            'mask' => fn (string $phone): string => LogAuthenticationEvents::maskPhone($phone),
            // Bukti H6: fungsi PHP yang dimatikan untuk proses website ini (pool PHP-FPM pasarku).
            'disabledFunctions' => array_values(array_filter(array_map('trim', explode(',', (string) ini_get('disable_functions'))))),
        ]);
    }

    public function disable(Request $request, User $user): RedirectResponse
    {
        $this->guardTarget($request, $user);

        $user->forceFill(['disabled_at' => now()])->save();
        AuditLog::record($request->user(), 'admin.disable_account', $user);

        return back()->with('success', 'Akun '.$user->business_name.' dinonaktifkan.');
    }

    public function enable(Request $request, User $user): RedirectResponse
    {
        $this->guardTarget($request, $user);

        $user->forceFill(['disabled_at' => null])->save();
        AuditLog::record($request->user(), 'admin.enable_account', $user);

        return back()->with('success', 'Akun '.$user->business_name.' diaktifkan kembali.');
    }

    /** Admin hanya mengelola akun pemilik usaha (bukan dirinya sendiri, admin lain, atau akun demo). */
    private function guardTarget(Request $request, User $user): void
    {
        abort_if($user->is_demo || $user->is($request->user()) || $user->role === UserRole::Admin, 403);
    }
}
