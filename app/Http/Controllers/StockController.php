<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Stock\AdjustStockAction;
use App\Actions\Stock\RecordWasteAction;
use App\Actions\Stock\RestockProductAction;
use App\Http\Requests\Stock\AdjustStockRequest;
use App\Http\Requests\Stock\RestockRequest;
use App\Http\Requests\Stock\SaveProductRequest;
use App\Http\Requests\Stock\WasteStockRequest;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockController extends Controller
{
    public function index(Request $request): View
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'low' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['name', 'stock', 'buy_price', 'sell_price'])],
        ]);

        $user = $request->user();
        $query = $user->products();

        if (! empty($data['q'])) {
            $query->where('name', 'like', '%'.$data['q'].'%');
        }

        if ($request->boolean('low')) {
            $query->whereColumn('stock', '<=', 'min_stock');
        }

        $stats = $user->products()
            ->selectRaw('COUNT(*) as total_types')
            ->selectRaw('COALESCE(SUM(ROUND(stock * buy_price)), 0) as total_value')
            ->selectRaw('COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) as low_count')
            ->first();

        return view('stock', [
            'products' => $query->orderBy($data['sort'] ?? 'name')->paginate(12)->withQueryString(),
            'value' => (int) round((float) ($stats->total_value ?? 0)),
            'lowCount' => (int) ($stats->low_count ?? 0),
            'totalTypes' => (int) ($stats->total_types ?? 0),
            'wasteLogs' => $user->wasteLogs()->with('product')->latest('id')->limit(8)->get(),
        ]);
    }

    public function store(SaveProductRequest $request): RedirectResponse
    {
        $request->user()->products()->create($request->validated());

        return back()->with('success', 'Barang berhasil ditambahkan.');
    }

    public function update(SaveProductRequest $request, string $product): RedirectResponse
    {
        $item = $request->user()->products()->findOrFail($product);
        $data = $request->validated();
        unset($data['stock']);
        $item->update($data);

        return back()->with('success', 'Data barang diperbarui. Gunakan stok masuk atau susut untuk mengubah jumlah.');
    }

    public function adjust(AdjustStockRequest $request, string $product, AdjustStockAction $action): RedirectResponse
    {
        $action->execute($request->user(), $product, (float) $request->validated('delta'));

        return back()->with('success', 'Jumlah stok diperbarui.');
    }

    public function restock(RestockRequest $request, string $product, RestockProductAction $action): RedirectResponse
    {
        $action->execute($request->user(), $product, $request->validated(), $request->boolean('record_expense'));

        return back()->with('success', 'Stok masuk berhasil dicatat.');
    }

    public function waste(WasteStockRequest $request, string $product, RecordWasteAction $action): RedirectResponse
    {
        $action->execute($request->user(), $product, $request->validated());

        return back()->with('success', 'Barang susut dicatat dan stok dikurangi.');
    }

    public function destroy(Request $request, string $product): RedirectResponse
    {
        $request->user()->products()->findOrFail($product)->delete();

        return back()->with('success', 'Barang dihapus.');
    }
}
