<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class Bookkeeping
{
    public const array INCOME = [
        'Penjualan',
        'Bayar kasbon',
        'Lain-lain',
    ];

    public const array EXPENSE = [
        'Belanja modal',
        'Ongkos/transport',
        'Retribusi pasar',
        'Listrik/es',
        'Gaji karyawan',
        'Pribadi (prive)',
        'Bayar utang',
        'Lain-lain',
    ];

    public const array UNITS = [
        'kg',
        'ons',
        'ikat',
        'tumpuk',
        'butir',
        'karung',
        'bungkus',
        'liter',
        'pcs',
    ];

    public const array WASTE_REASONS = [
        'Busuk / Layu',
        'Rusak / Pecah',
        'Hilang / Tumpah',
        'Lainnya',
    ];

    public const int MAX_MONEY = 1000000000000;

    public static function phone(string $phone): string
    {
        $cleaned = preg_replace('/\D/', '', $phone) ?? '';

        return str_starts_with($cleaned, '62') ? '0'.substr($cleaned, 2) : $cleaned;
    }

    /**
     * @param  Collection<int, Transaction>  $transactions
     * @return array{income: int, expense: int, prive: int, business_expense: int, profit: int}
     */
    public static function summary(Collection $transactions): array
    {
        $income = (int) $transactions->where('type', TransactionType::In->value)->sum('amount');
        $expense = (int) $transactions->where('type', TransactionType::Out->value)->sum('amount');
        $prive = (int) $transactions
            ->where('type', TransactionType::Out->value)
            ->where('category', 'Pribadi (prive)')
            ->sum('amount');

        return [
            'income' => $income,
            'expense' => $expense,
            'prive' => $prive,
            'business_expense' => $expense - $prive,
            'profit' => $income - $expense + $prive,
        ];
    }

    public static function cash(User $user): int
    {
        $net = (int) $user->transactions()
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END), 0) AS net")
            ->value('net');

        return $user->starting_cash + $net;
    }

    /**
     * @return array<string, mixed>
     */
    public static function report(Request $request): array
    {
        $filters = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month'])],
            'offset' => ['nullable', 'integer', 'between:-120,120'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $period = (string) ($filters['period'] ?? 'week');
        $offset = (int) ($filters['offset'] ?? 0);
        $anchor = today();

        [$from, $to] = match ($period) {
            'day' => [
                $anchor->copy()->addDays($offset),
                $anchor->copy()->addDays($offset),
            ],
            'month' => [
                $anchor->copy()->addMonthsNoOverflow($offset)->startOfMonth(),
                $anchor->copy()->addMonthsNoOverflow($offset)->endOfMonth(),
            ],
            default => [
                $anchor->copy()->addWeeks($offset)->startOfWeek(),
                $anchor->copy()->addWeeks($offset)->endOfWeek(),
            ],
        };

        if (! empty($filters['from'])) {
            $from = Carbon::parse($filters['from']);
        }

        if (! empty($filters['to'])) {
            $to = Carbon::parse($filters['to']);
        }

        if ($from->gt($to) || $from->diffInDays($to) > 366) {
            throw ValidationException::withMessages([
                'from' => 'Rentang tanggal harus berurutan, maksimal 366 hari.',
            ]);
        }

        /** @var User $user */
        $user = $request->user();

        $transactions = $user->transactions()
            ->whereDate('occurred_on', '>=', $from->toDateString())
            ->whereDate('occurred_on', '<=', $to->toDateString())
            ->orderBy('occurred_on')
            ->orderBy('id')
            ->get();

        $days = collect();
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $date = $day->toDateString();
            $dailyTransactions = $transactions->filter(
                fn (Transaction $tx): bool => $tx->occurred_on->toDateString() === $date
            );

            $days->push([
                'date' => $day->copy(),
                ...self::summary($dailyTransactions),
            ]);
        }

        $categories = $transactions
            ->where('type', TransactionType::Out->value)
            ->groupBy('category')
            ->map->sum('amount')
            ->sortDesc();

        $wasteCost = (int) $user->wasteLogs()
            ->whereDate('occurred_on', '>=', $from->toDateString())
            ->whereDate('occurred_on', '<=', $to->toDateString())
            ->sum('cost');

        return [
            'period' => $period,
            'offset' => $offset,
            'from' => $from,
            'to' => $to,
            'transactions' => $transactions,
            'days' => $days,
            'categories' => $categories,
            'wasteCost' => $wasteCost,
            'summary' => self::summary($transactions),
        ];
    }
}
