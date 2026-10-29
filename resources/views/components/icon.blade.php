@props(['name'=>'home'])
@php
$paths=[
 'home'=>'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
 'record'=>'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
 'debts'=>'<path d="M3 7h18v13H3zM6 3h12v4M7 12h4m-4 4h7"/><circle cx="17" cy="12" r="1"/>',
 'stock'=>'<path d="m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4m-9 4v11m-5-17 9 4"/>',
 'reports'=>'<path d="M4 3v18h17M8 16v-4m5 4V7m5 9V4"/>',
 'history'=>'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2"/>',
 'settings'=>'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 'store'=>'<path d="M3 10h18l-2-7H5Zm1 0v11h16V10M9 21v-7h6v7M8 3l-1 7m9-7 1 7"/>',
 'plus'=>'<path d="M12 5v14M5 12h14"/>',
 'arrow'=>'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 'menu'=>'<path d="M4 6h16M4 12h16M4 18h16"/>',
 'logout'=>'<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h10"/>',
 'wallet'=>'<path d="M20 7H4V4h14v3M4 7v13h17V7M17 12h4v4h-4z"/>',
 'check'=>'<path d="m5 12 4 4L19 6"/>',
];
@endphp
<svg {{ $attributes->merge(['class'=>'icon']) }} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{!! $paths[$name] ?? $paths['home'] !!}</svg>
