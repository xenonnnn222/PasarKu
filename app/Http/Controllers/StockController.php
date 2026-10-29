<?php

namespace App\Http\Controllers;

use App\Support\Bookkeeping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StockController extends Controller
{
    public function index(Request $r)
    {
        $data = $r->validate(['q' => 'nullable|string|max:100', 'low' => 'nullable|boolean', 'sort' => ['nullable', Rule::in(['name', 'stock', 'buy_price', 'sell_price'])]]);
        $query = $r->user()->products();
        if (! empty($data['q'])) {
            $query->where('name', 'like', '%'.$data['q'].'%');
        }if ($r->boolean('low')) {
            $query->whereColumn('stock', '<=', 'min_stock');
        }
        $all = $r->user()->products()->get();
        $value = $all->sum(fn ($p) => round($p->stock * $p->buy_price));
        $lowCount = $all->filter(fn ($p) => $p->stock <= $p->min_stock)->count();

        return view('stock', ['products' => $query->orderBy($data['sort'] ?? 'name')->paginate(12)->withQueryString(), 'value' => $value, 'lowCount' => $lowCount, 'totalTypes' => $all->count(), 'wasteLogs' => $r->user()->wasteLogs()->with('product')->latest('id')->limit(8)->get()]);
    }

    private function data(Request $r): array
    {
        return $r->validate(['name' => 'required|string|max:150', 'unit' => ['required', Rule::in(Bookkeeping::UNITS)], 'stock' => 'required|numeric|min:0|max:10000000|decimal:0,2', 'min_stock' => 'required|numeric|min:0|max:10000000|decimal:0,2', 'buy_price' => 'required|integer|min:0|max:'.Bookkeeping::MAX_MONEY, 'sell_price' => 'required|integer|min:0|max:'.Bookkeeping::MAX_MONEY]);
    }

    public function store(Request $r)
    {
        $r->user()->products()->create($this->data($r));

        return back()->with('success', 'Barang berhasil ditambahkan.');
    }

    public function update(Request $r, string $product)
    {
        $item = $r->user()->products()->findOrFail($product);
        $data = $this->data($r);
        unset($data['stock']);
        $item->update($data);

        return back()->with('success', 'Data barang diperbarui. Gunakan stok masuk atau susut untuk mengubah jumlah.');
    }

    public function adjust(Request $r, string $product)
    {
        $data = $r->validate(['delta' => ['required', Rule::in([-1, 1])]]);
        DB::transaction(function () use ($r, $product, $data) {
            $item = $r->user()->products()->lockForUpdate()->findOrFail($product);
            $stock = round((float) $item->stock + (float) $data['delta'], 2);
            if ($stock < 0) {
                throw ValidationException::withMessages(['stock' => 'Stok tidak boleh negatif.']);
            }$item->update(['stock' => $stock]);
        }, 5);

        return back()->with('success', 'Jumlah stok diperbarui.');
    }

    public function restock(Request $r, string $product)
    {
        $data = $r->validate(['qty' => 'required|numeric|gt:0|max:10000000|decimal:0,2', 'buy_price' => 'required|integer|min:0|max:'.Bookkeeping::MAX_MONEY]);
        DB::transaction(function () use ($r, $product, $data) {
            $item = $r->user()->products()->lockForUpdate()->findOrFail($product);
            $stock = round((float) $item->stock + (float) $data['qty'], 2);
            $cost = round($data['qty'] * $data['buy_price']);
            if ($stock > 10000000 || $cost > Bookkeeping::MAX_MONEY) {
                throw ValidationException::withMessages(['qty' => 'Jumlah stok atau nilai pembelian terlalu besar.']);
            }
            $item->update(['stock' => $stock, 'buy_price' => $data['buy_price']]);
            if ($r->boolean('record_expense') && $cost > 0) {
                $r->user()->transactions()->create(['type' => 'out', 'amount' => (int) $cost, 'category' => 'Belanja modal', 'note' => 'Kulakan '.$item->name.' ('.$data['qty'].' '.$item->unit.')', 'occurred_on' => today(), 'source' => 'restock']);
            }
        }, 5);

        return back()->with('success', 'Stok masuk berhasil dicatat.');
    }

    public function waste(Request $r, string $product)
    {
        $data = $r->validate(['qty' => 'required|numeric|gt:0|max:10000000|decimal:0,2', 'reason' => ['required', Rule::in(Bookkeeping::WASTE_REASONS)]]);
        DB::transaction(function () use ($r, $product, $data) {
            $item = $r->user()->products()->lockForUpdate()->findOrFail($product);
            if ($data['qty'] > (float) $item->stock) {
                throw ValidationException::withMessages(['qty' => 'Barang susut melebihi stok tersedia.']);
            }
            $cost = round($data['qty'] * $item->buy_price);
            if ($cost > Bookkeeping::MAX_MONEY) {
                throw ValidationException::withMessages(['qty' => 'Nilai barang susut terlalu besar.']);
            }$r->user()->wasteLogs()->create($data + ['product_id' => $item->id, 'cost' => (int) $cost, 'occurred_on' => today()]);
            $item->update(['stock' => round((float) $item->stock - $data['qty'], 2)]);
        }, 5);

        return back()->with('success', 'Barang susut dicatat dan stok dikurangi.');
    }

    public function destroy(Request $r, string $product)
    {
        $r->user()->products()->findOrFail($product)->delete();

        return back()->with('success', 'Barang dihapus.');
    }
}
