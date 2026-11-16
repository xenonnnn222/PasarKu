<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\DemoData;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function loginForm(): View
    {
        return view('auth', ['register' => false]);
    }

    public function registerForm(): View
    {
        return view('auth', ['register' => true]);
    }

    public function register(RegisterRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $user = User::create([
            ...$data,
            'password' => $data['pin'],
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()
            ->route('home')
            ->with('success', 'Usaha Anda siap dicatat. Selamat datang!');
    }

    public function login(LoginRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if (! Auth::attempt(['phone' => $data['phone'], 'password' => $data['pin']])) {
            throw ValidationException::withMessages([
                'phone' => 'Nomor HP atau PIN tidak sesuai.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('home'));
    }

    public function demo(Request $request, DemoData $demo): RedirectResponse
    {
        $user = DB::transaction(function () use ($demo): User {
            $user = User::create([
                'name' => 'Bu Sari',
                'business_name' => 'Lapak Sayur Bu Sari',
                'phone' => 'demo:'.Str::uuid(),
                'password' => Str::random(40),
                'starting_cash' => 500000,
                'is_demo' => true,
            ]);

            $demo->populate($user);

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()
            ->route('home')
            ->with('success', 'Mode demo aktif. Data contoh ini terpisah dari pengguna lain.');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
