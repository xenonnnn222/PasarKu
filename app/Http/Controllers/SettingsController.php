<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Settings\ConfirmDestructiveActionRequest;
use App\Http\Requests\Settings\ImportBackupRequest;
use App\Http\Requests\Settings\UpdatePinRequest;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Models\User;
use App\Services\DemoData;
use App\Services\LegacyData;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SettingsController extends Controller
{
    public function index(): View
    {
        return view('settings');
    }

    public function update(UpdateSettingsRequest $request): RedirectResponse
    {
        $request->user()->update($request->validated());

        return back()->with('success', 'Pengaturan usaha tersimpan.');
    }

    public function pin(UpdatePinRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if (! Hash::check($data['current_pin'], $request->user()->password)) {
            throw ValidationException::withMessages([
                'current_pin' => 'PIN saat ini tidak sesuai.',
            ]);
        }

        $request->user()->update(['password' => $data['pin']]);
        $request->session()->regenerate();

        return back()->with('success', 'PIN diperbarui.');
    }

    public function import(ImportBackupRequest $request, LegacyData $legacy): RedirectResponse
    {
        $json = $request->hasFile('backup')
            ? $request->file('backup')->getContent()
            : $request->input('payload');

        try {
            $data = json_decode((string) $json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ValidationException::withMessages([
                'import' => 'File cadangan tidak berisi JSON yang valid.',
            ]);
        }

        if (! is_array($data)) {
            throw ValidationException::withMessages([
                'import' => 'Format cadangan tidak valid.',
            ]);
        }

        $legacy->import($request->user(), $data);

        return back()->with('success', 'Data berhasil diimpor. Profil dan PIN akun tetap milik Anda.');
    }

    public function backup(Request $request, LegacyData $legacy): StreamedResponse
    {
        $filename = 'pasarku-backup-'.today()->format('Y-m-d').'.json';

        return response()->streamDownload(function () use ($request, $legacy): void {
            echo json_encode(
                $legacy->export($request->user()),
                JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR
            );
        }, $filename, ['Content-Type' => 'application/json']);
    }

    private function clearUserData(User $user): void
    {
        $user->wasteLogs()->delete();
        $user->transactions()->delete();
        $user->debts()->delete();
        $user->products()->delete();
    }

    public function clear(ConfirmDestructiveActionRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $this->clearUserData($user);
            $user->update(['starting_cash' => 0]);
        }, 5);

        return back()->with('success', 'Pembukuan akun ini sudah dikosongkan.');
    }

    public function reset(ConfirmDestructiveActionRequest $request, DemoData $demo): RedirectResponse
    {
        DB::transaction(function () use ($request, $demo): void {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $this->clearUserData($user);
            $demo->populate($user);
        }, 5);

        return back()->with('success', 'Data contoh berhasil dimuat ke akun ini.');
    }
}
