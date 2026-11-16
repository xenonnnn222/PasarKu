<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\DebtType;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Support\Bookkeeping;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PageController extends Controller
{
    public function home(Request $request): View
    {
        $user = $request->user();
        $today = $user->transactions()->whereDate('occurred_on', today())->get();
        $recent = $user->transactions()->orderByDesc('occurred_on')->orderByDesc('id')->limit(8)->get();

        $week = $user->transactions()
            ->whereDate('occurred_on', '>=', today()->subDays(6)->toDateString())
            ->whereDate('occurred_on', '<=', today()->toDateString())
            ->get();

        $chart = collect(range(6, 0))->map(function (int $ago) use ($week): array {
            $date = today()->subDays($ago);

            return [
                'date' => $date,
                ...Bookkeeping::summary($week->filter(fn (Transaction $tx): bool => $tx->occurred_on->isSameDay($date))),
            ];
        });

        $lowStockCount = $user->products()->whereColumn('stock', '<=', 'min_stock')->count();
        $overdue = $user->debts()->whereColumn('paid', '<', 'total')->whereDate('due_date', '<', today())->count();
        $receivable = (int) $user->debts()
            ->where('type', DebtType::Receivable->value)
            ->selectRaw('COALESCE(SUM(total-paid),0) AS balance')
            ->value('balance');

        return view('home', compact('recent', 'chart', 'lowStockCount', 'overdue', 'receivable') + [
            'summary' => Bookkeeping::summary($today),
            'cash' => Bookkeeping::cash($user),
        ]);
    }

    public function reports(Request $request): View
    {
        return view('reports', Bookkeeping::report($request));
    }

    public function csv(Request $request): StreamedResponse
    {
        $report = Bookkeeping::report($request);
        $filename = 'laporan-'.$report['from']->format('Y-m-d').'-'.$report['to']->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($report): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }

            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Tanggal', 'Jenis', 'Kategori', 'Catatan', 'Uang masuk', 'Uang keluar'], ',', '"', '');

            $safe = fn (mixed $v): mixed => preg_match('/^[\s]*[=+@\-]/u', (string) $v) ? "'".$v : $v;

            foreach ($report['transactions'] as $tx) {
                $isIn = $tx->type === TransactionType::In->value;
                fputcsv($out, [
                    $tx->occurred_on->format('Y-m-d'),
                    $isIn ? 'Masuk' : 'Keluar',
                    $safe($tx->category),
                    $safe($tx->note),
                    $isIn ? $tx->amount : 0,
                    ! $isIn ? $tx->amount : 0,
                ], ',', '"', '');
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
