<?php

namespace App\Http\Controllers;

use App\Services\DemoData;
use App\Services\LegacyData;
use App\Support\Bookkeeping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function index()
    {
        return view('settings');
    }

    public function update(Request $r)
    {
        $r->merge(['phone' => Bookkeeping::phone((string) $r->input('phone'))]);
        $data = $r->validate(['name' => 'required|string|max:100', 'business_name' => 'required|string|max:150', 'phone' => ['required', 'regex:/^08[1-9][0-9]{7,10}$/', Rule::unique('users', 'phone')->ignore($r->user()->id)], 'starting_cash' => 'required|integer|min:0|max:'.Bookkeeping::MAX_MONEY, 'theme' => ['required', Rule::in(['light', 'dark'])], 'font_size' => ['required', Rule::in(['normal', 'large'])]]);
        $r->user()->update($data);

        return back()->with('success', 'Pengaturan usaha tersimpan.');
    }

    public function pin(Request $r)
    {
        $data = $r->validate(['current_pin' => 'required|string', 'pin' => ['required', 'regex:/^\d{4}$/', 'confirmed']]);
        if (! Hash::check($data['current_pin'], $r->user()->password)) {
            throw ValidationException::withMessages(['current_pin' => 'PIN saat ini tidak sesuai.']);
        }
        $r->user()->update(['password' => $data['pin']]);
        $r->session()->regenerate();

        return back()->with('success', 'PIN diperbarui.');
    }

    public function import(Request $r, LegacyData $legacy)
    {
        $r->validate(['backup' => 'nullable|file|max:2048', 'payload' => 'nullable|string|max:2097152']);
        $json = $r->hasFile('backup') ? $r->file('backup')->getContent() : $r->input('payload');
        try {
            $data = json_decode((string) $json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ValidationException::withMessages(['import' => 'File cadangan tidak berisi JSON yang valid.']);
        }
        if (! is_array($data)) {
            throw ValidationException::withMessages(['import' => 'Format cadangan tidak valid.']);
        }
        $legacy->import($r->user(), $data);

        return back()->with('success', 'Data berhasil diimpor. Profil dan PIN akun tetap milik Anda.');
    }

    public function backup(Request $r, LegacyData $legacy)
    {
        return response()->streamDownload(function () use ($r, $legacy) {
            echo json_encode($legacy->export($r->user()), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        }, 'pasarku-backup-'.today()->format('Y-m-d').'.json', ['Content-Type' => 'application/json']);
    }

    private function clearUserData($user): void
    {
        $user->wasteLogs()->delete();
        $user->transactions()->delete();
        $user->debts()->delete();
        $user->products()->delete();
    }

    private function confirmation(Request $r): void
    {
        $r->validate(['confirmation' => ['required', Rule::in(['HAPUS'])]]);
    }

    public function clear(Request $r)
    {
        $this->confirmation($r);
        DB::transaction(function () use ($r) {
            $user = $r->user()->newQuery()->lockForUpdate()->findOrFail($r->user()->id);
            $this->clearUserData($user);
            $user->update(['starting_cash' => 0]);
        }, 5);

        return back()->with('success', 'Pembukuan akun ini sudah dikosongkan.');
    }

    public function reset(Request $r, DemoData $demo)
    {
        $this->confirmation($r);
        DB::transaction(function () use ($r, $demo) {
            $user = $r->user()->newQuery()->lockForUpdate()->findOrFail($r->user()->id);
            $this->clearUserData($user);
            $demo->populate($user);
        }, 5);

        return back()->with('success', 'Data contoh berhasil dimuat ke akun ini.');
    }
}
