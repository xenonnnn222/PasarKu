@if($paginator->hasPages())
<nav role="navigation" aria-label="Navigasi halaman"><div>
@if($paginator->onFirstPage())<span aria-disabled="true">← Sebelumnya</span>@else<a href="{{ $paginator->previousPageUrl() }}" rel="prev">← Sebelumnya</a>@endif
<span>Halaman {{ $paginator->currentPage() }}</span>
@if($paginator->hasMorePages())<a href="{{ $paginator->nextPageUrl() }}" rel="next">Berikutnya →</a>@else<span aria-disabled="true">Berikutnya →</span>@endif
</div></nav>
@endif
