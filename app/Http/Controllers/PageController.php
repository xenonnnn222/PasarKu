<?php

namespace App\Http\Controllers;

use App\Support\Bookkeeping;
use Illuminate\Http\Request;

class PageController extends Controller
{
    public function home(Request $r)
    {
        $user = $r->user();
        $today = $user->transactions()->whereDate('occurred_on', today())->get();
        $recent = $user->transactions()->orderByDesc('occurred_on')->orderByDesc('id')->limit(8)->get();
        $week = $user->transactions()->whereDate('occurred_on', '>=', today()->subDays(6)->toDateString())->whereDate('occurred_on', '<=', today()->toDateString())->get();
        $chart = collect(range(6, 0))->map(function ($ago) use ($week) {
            $date = today()->subDays($ago);

            return ['date' => $date, ...Bookkeeping::summary($week->filter(fn ($tx) => $tx->occurred_on->isSameDay($date)))];
        });
        $lowStockCount = $user->products()->whereColumn('stock', '<=', 'min_stock')->count();
        $overdue = $user->debts()->whereColumn('paid', '<', 'total')->whereDate('due_date', '<', today())->count();
        $receivable = (int) $user->debts()->where('type', 'piutang')->selectRaw('COALESCE(SUM(total-paid),0) AS balance')->value('balance');

        return view('home', compact('recent', 'chart', 'lowStockCount', 'overdue', 'receivable') + ['summary' => Bookkeeping::summary($today), 'cash' => Bookkeeping::cash($user)]);
    }

    public function reports(Request $r)
    {
        return view('reports', Bookkeeping::report($r));
    }

    public function csv(Request $r)
    {
        $report = Bookkeeping::report($r);

        return response()->streamDownload(function () use ($report) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Tanggal', 'Jenis', 'Kategori', 'Catatan', 'Uang masuk', 'Uang keluar'], ',', '"', '');
            foreach ($report['transactions'] as $tx) {
                $safe = fn ($v) => preg_match('/^[\s]*[=+@\-]/u', (string) $v) ? "'".$v : $v;
                fputcsv($out, [$tx->occurred_on->format('Y-m-d'), $tx->type === 'in' ? 'Masuk' : 'Keluar', $safe($tx->category), $safe($tx->note), $tx->type === 'in' ? $tx->amount : 0, $tx->type === 'out' ? $tx->amount : 0], ',', '"', '');
            } fclose($out);
        }, 'laporan-'.$report['from']->format('Y-m-d').'-'.$report['to']->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
