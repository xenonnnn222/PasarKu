@extends('layouts.app')
@section('title','Riwayat transaksi')
@section('subtitle','Telusuri setiap pemasukan dan pengeluaran usaha Anda.')
@section('content')
<form method="get" class="card filter-row"><label>Cari catatan<input name="q" value="{{ request('q') }}" placeholder="Kategori atau catatan" maxlength="100"></label><label>Jenis<select name="type"><option value="">Semua</option><option value="in" @selected(request('type')==='in')>Uang masuk</option><option value="out" @selected(request('type')==='out')>Uang keluar</option></select></label><label>Dari<input type="date" name="from" value="{{ request('from') }}"></label><label>Sampai<input type="date" name="to" value="{{ request('to') }}"></label><label>Urutan<select name="sort">@foreach(['newest'=>'Terbaru','oldest'=>'Terlama','largest'=>'Nominal terbesar','smallest'=>'Nominal terkecil'] as $value=>$label)<option value="{{ $value }}" @selected(request('sort','newest')===$value)>{{ $label }}</option>@endforeach</select></label><button class="btn primary" type="submit">Terapkan</button><a href="{{ route('transactions.index') }}" class="text-link">Reset</a></form>
<section class="card no-pad">@include('partials/transactions',['editable'=>true])<div class="pagination-row"><span>{{ $transactions->total() }} transaksi</span>{{ $transactions->links('partials.pagination') }}</div></section>
@endsection
