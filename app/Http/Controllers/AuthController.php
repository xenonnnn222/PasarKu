<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DemoData;
use App\Support\Bookkeeping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function loginForm()
    {
        return view('auth', ['register' => false]);
    }

    public function registerForm()
    {
        return view('auth', ['register' => true]);
    }

    public function register(Request $r)
    {
        $r->merge(['phone' => Bookkeeping::phone((string) $r->input('phone'))]);
        $data = $r->validate(['name' => 'required|string|max:100', 'business_name' => 'required|string|max:150', 'phone' => ['required', 'regex:/^08[1-9][0-9]{7,10}$/', 'unique:users,phone'], 'pin' => ['required', 'regex:/^\d{4}$/', 'confirmed'], 'starting_cash' => 'required|integer|min:0|max:'.Bookkeeping::MAX_MONEY]);
        $user = User::create([...$data, 'password' => $data['pin']]);
        Auth::login($user);
        $r->session()->regenerate();

        return redirect()->route('home')->with('success', 'Usaha Anda siap dicatat. Selamat datang!');
    }

    public function login(Request $r)
    {
        $r->merge(['phone' => Bookkeeping::phone((string) $r->input('phone'))]);
        $data = $r->validate(['phone' => 'required|string|max:20', 'pin' => ['required', 'regex:/^\d{4}$/']]);
        if (! Auth::attempt(['phone' => $data['phone'], 'password' => $data['pin']])) {
            throw ValidationException::withMessages(['phone' => 'Nomor HP atau PIN tidak sesuai.']);
        }
        $r->session()->regenerate();

        return redirect()->intended(route('home'));
    }

    public function demo(Request $r, DemoData $demo)
    {
        $user = DB::transaction(function () use ($demo) {
            $user = User::create(['name' => 'Bu Sari', 'business_name' => 'Lapak Sayur Bu Sari', 'phone' => 'demo:'.Str::uuid(), 'password' => Str::random(40), 'starting_cash' => 500000, 'is_demo' => true]);
            $demo->populate($user);

            return $user;
        });
        Auth::login($user);
        $r->session()->regenerate();

        return redirect()->route('home')->with('success', 'Mode demo aktif. Data contoh ini terpisah dari pengguna lain.');
    }

    public function logout(Request $r)
    {
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return redirect()->route('login');
    }
}
