@extends('layouts.app')
@section('title','Admin sistem')
@section('subtitle','Kelola status akun pemilik usaha. Data keuangan setiap usaha tidak terlihat di sini.')
@section('content')
<form method="get" class="card filter-row"><label>Cari akun<input name="q" value="{{ request('q') }}" maxlength="100" placeholder="Nama pemilik atau usaha"></label><button class="btn primary" type="submit">Cari</button><a class="text-link" href="{{ route('admin.index') }}">Reset</a></form>
<section class="card no-pad"><div class="table-wrap"><table><thead><tr><th>Pemilik / usaha</th><th>Nomor HP</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
@forelse($accounts as $account)
<tr><td><strong>{{ $account->name }}</strong><small>{{ $account->business_name }}</small></td><td>{{ $mask($account->phone) }}</td><td>{{ $account->role->label() }}</td>
<td><span class="pill {{ $account->isDisabled()?'red':'green' }}">{{ $account->isDisabled()?'Nonaktif':'Aktif' }}</span></td>
<td>@if($account->role===\App\Enums\UserRole::Owner)<form method="post" action="{{ route($account->isDisabled()?'admin.enable':'admin.disable',$account->id) }}">@csrf<button class="btn {{ $account->isDisabled()?'secondary':'danger' }} small" type="submit">{{ $account->isDisabled()?'Aktifkan':'Nonaktifkan' }}</button></form>@else<span class="muted">—</span>@endif</td></tr>
@empty
<tr><td colspan="5" class="muted">Belum ada akun pemilik usaha.</td></tr>
@endforelse
</tbody></table></div><div class="pagination-row"><span>{{ $accounts->total() }} akun</span>{{ $accounts->links('partials.pagination') }}</div></section>
<section class="card"><h2>Jejak aktivitas admin</h2><p class="hint">20 aktivitas terakhir. Salinan lengkap juga tersimpan di log keamanan server.</p>
@forelse($logs as $log)<div class="list-row"><span><strong>{{ $log->action }}</strong><small>{{ $log->actor?->name ?? 'Server (CLI)' }}@if($log->target) → {{ $log->target->name }}@endif · IP {{ $log->ip }}</small></span><span class="right"><small>{{ $log->created_at->format('d/m/Y H:i') }}</small></span></div>
@empty<p class="muted">Belum ada aktivitas.</p>@endforelse</section>
<section class="card"><h2>Status keamanan server</h2><div class="list-row"><span><strong>Fungsi PHP yang dimatikan</strong><small>exec, system, shell_exec, dan sejenisnya untuk proses website ini</small></span><span class="right"><strong>{{ $disabledFunctions ? implode(', ', $disabledFunctions) : 'Tidak ada' }}</strong></span></div></section>
@endsection
