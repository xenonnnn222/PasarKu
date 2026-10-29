@extends('layouts.app')
@section('title',$register?'Daftar usaha':'Masuk')
@section('content')
<div class="auth-layout"><section class="auth-story"><a class="brand" href="{{ route('onboarding') }}"><span class="brand-icon"><x-icon name="store"/></span><span>PasarKu<small>BUKU USAHA ANDA</small></span></a><div><span class="story-label">UNTUK PEDAGANG PASAR INDONESIA</span><h1>Usaha berjalan.<br>Catatan tetap rapi.</h1><p>Uang masuk, kasbon, dan stok dagangan—semua tercatat di satu tempat.</p><div class="story-points"><p><x-icon name="check"/> Pisahkan uang usaha dan uang pribadi</p><p><x-icon name="check"/> Pantau kasbon dan persediaan barang</p><p><x-icon name="check"/> Lihat laporan kapan saja</p></div></div><small>Pembukuan sederhana, keputusan usaha lebih jelas.</small></section>
<section class="auth-form"><div class="auth-card"><p class="eyebrow">SELAMAT DATANG DI PASARKU</p><h2>{{ $register?'Mulai usaha yang lebih tertata':'Masuk ke ruang usaha' }}</h2><p class="subtitle">{{ $register?'Daftarkan profil lapak dan buat PIN Anda.':'Gunakan nomor HP dan PIN 4 angka Anda.' }}</p>@include('partials.feedback')
<form method="post" action="{{ route($register?'register.store':'login.store') }}" class="stack">@csrf
@if($register)<label>Nama pemilik<input name="name" value="{{ old('name') }}" autocomplete="name" maxlength="100" required placeholder="Contoh: Bu Sari"></label><label>Nama usaha / lapak<input name="business_name" value="{{ old('business_name') }}" maxlength="150" required placeholder="Contoh: Lapak Sayur Berkah"></label>@endif
<label>Nomor HP<input name="phone" type="tel" autocomplete="tel" value="{{ old('phone') }}" required maxlength="20" placeholder="081234567890"></label>
@if($register)<label>Modal kas awal (Rp)<input name="starting_cash" type="number" value="{{ old('starting_cash',500000) }}" min="0" max="1000000000000" step="1" required></label>@endif
<label>{{ $register?'Buat PIN 4 angka':'PIN 4 angka' }}<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="{{ $register?'new-password':'current-password' }}" required placeholder="••••"></label>
@if($register)<label>Ulangi PIN<input name="pin_confirmation" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required placeholder="••••"></label>@endif
<button class="btn primary full" type="submit">{{ $register?'Daftar & buka dashboard':'Masuk ke dashboard' }} <x-icon name="arrow"/></button>
</form>
@unless($register)<div class="separator">ATAU LIHAT CONTOH TERLEBIH DAHULU</div><form method="post" action="{{ route('demo') }}">@csrf<button type="submit" class="btn secondary full">Coba demo Lapak Bu Sari</button></form>@endunless
<p class="auth-switch">{{ $register?'Sudah punya akun?':'Belum punya akun usaha?' }} <a href="{{ route($register?'login':'register') }}">{{ $register?'Masuk di sini':'Daftar sekarang' }}</a></p></div></section></div>
@endsection
