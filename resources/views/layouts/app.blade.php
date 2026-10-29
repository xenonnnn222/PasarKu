<!doctype html>
<html lang="id" data-theme="{{ auth()->user()?->theme ?? 'light' }}" data-font="{{ auth()->user()?->font_size ?? 'normal' }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Pembukuan sederhana untuk pedagang pasar: transaksi, kasbon, stok, dan laporan usaha."><meta name="csrf-token" content="{{ csrf_token() }}"><title>@yield('title', 'Beranda') · PasarKu</title><link rel="icon" href="{{ asset('icons/icon.svg') }}" type="image/svg+xml"><link rel="stylesheet" href="{{ asset('css/app.css') }}?v={{ filemtime(public_path('css/app.css')) }}"><script defer src="{{ asset('js/app.js') }}?v={{ filemtime(public_path('js/app.js')) }}"></script></head>
<body class="{{ auth()->check() ? 'app-shell' : 'guest-shell' }}">
<a class="skip-link" href="#main">Lewati ke konten</a>
@auth
<aside id="sidebar" class="sidebar" aria-label="Navigasi utama">
    <a class="brand" href="{{ route('home') }}"><span class="brand-icon"><x-icon name="store"/></span><span>PasarKu<small>BUKU USAHA ANDA</small></span></a>
    <p class="nav-heading">RUANG USAHA</p>
    <nav>@foreach([
        ['home','home','Beranda'],['transactions.create','record','Catat transaksi'],['transactions.index','history','Riwayat'],['debts.index','debts','Kasbon'],['stock.index','stock','Stok barang'],['reports','reports','Laporan'],['settings','settings','Pengaturan']
    ] as [$route,$icon,$label])
        @php($active=request()->routeIs($route)||($route==='transactions.index'&&request()->routeIs('transactions.edit')))
        <a href="{{ route($route) }}" class="nav-link {{ $active?'active':'' }}" @if($active) aria-current="page" @endif><x-icon :name="$icon"/><span>{{ $label }}</span></a>
    @endforeach</nav>
    <div class="sidebar-bottom"><div class="account"><span class="avatar">{{ mb_substr(auth()->user()->name,0,1) }}</span><span><strong>{{ auth()->user()->name }}</strong><small>{{ auth()->user()->business_name }}</small></span></div><form method="post" action="{{ route('logout') }}">@csrf<button class="nav-link" type="submit"><x-icon name="logout"/> Keluar akun</button></form></div>
</aside>
<div class="workspace"><header class="topbar"><button type="button" class="btn icon-button mobile-menu" data-menu-toggle aria-controls="sidebar" aria-expanded="false" aria-label="Buka navigasi"><x-icon name="menu"/></button><div class="breadcrumb">Ruang usaha <span>/</span> <strong>@yield('title','Beranda')</strong></div><span class="today">{{ now()->translatedFormat('l, d F Y') }}</span><a href="{{ route('transactions.create') }}" class="btn primary topbar-action"><x-icon name="plus"/> Catat transaksi</a></header>
<main id="main" class="main-content">
@if(auth()->user()->is_demo)<div class="notice demo-notice"><strong>Mode demo</strong><span>Data contoh terpisah untuk sesi Anda. Daftar akun untuk pembukuan usaha sendiri.</span></div>@endif
<div class="page-heading"><div><p class="eyebrow">{{ auth()->user()->business_name }}</p><h1>@yield('title','Beranda')</h1><p class="subtitle">@yield('subtitle','Catatan rapi, usaha lebih pasti.')</p></div>@yield('page-action')</div>
@include('partials.feedback')
@yield('content')
<footer class="page-footer"><span>PasarKu · Pembukuan pedagang pasar</span><span>Data tersimpan di akun Anda</span></footer>
</main></div>
@else
<main id="main">@yield('content')</main>
@endauth
</body></html>
