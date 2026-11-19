<!doctype html>
<html lang="id" data-theme="light">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>@yield('code') · PasarKu</title><link rel="icon" href="{{ asset('icons/icon.svg') }}" type="image/svg+xml"><link rel="stylesheet" href="{{ asset('css/app.css') }}"></head>
<body class="guest-shell">
<main id="main" class="error-page"><section class="card"><p class="eyebrow">PASARKU</p><p class="error-code">@yield('code')</p><h1>@yield('message')</h1><p class="subtitle">@yield('hint')</p><a class="btn primary" href="{{ url('/') }}">Kembali ke beranda</a></section></main>
</body></html>
