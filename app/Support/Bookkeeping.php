<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class Bookkeeping
{
    public const INCOME = ['Penjualan', 'Bayar kasbon', 'Lain-lain'];

    public const EXPENSE = ['Belanja modal', 'Ongkos/transport', 'Retribusi pasar', 'Listrik/es', 'Gaji karyawan', 'Pribadi (prive)', 'Bayar utang', 'Lain-lain'];

    public const UNITS = ['kg', 'ons', 'ikat', 'tumpuk', 'butir', 'karung', 'bungkus', 'liter', 'pcs'];

    public const WASTE_REASONS = ['Busuk / Layu', 'Rusak / Pecah', 'Hilang / Tumpah', 'Lainnya'];

    public const MAX_MONEY = 1000000000000;

    public static function phone(string $phone): string
    {
        $phone = preg_replace('/\D/', '', $phone);

        return str_starts_with($phone, '62') ? '0'.substr($phone, 2) : $phone;
    }

    public static function summary(Collection $transactions): array
    {
        $income = (int) $transactions->where('type', 'in')->sum('amount');
        $expense = (int) $transactions->where('type', 'out')->sum('amount');
        $prive = (int) $transactions->where('type', 'out')->where('category', 'Pribadi (prive)')->sum('amount');

        return compact('income', 'expense', 'prive') + ['business_expense' => $expense - $prive, 'profit' => $income - $expense + $prive];
    }

    public static function cash(User $user): int
    {
        return $user->starting_cash + (int) $user->transactions()->selectRaw("COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END),0) AS net")->value('net');
    }

    public static function report(Request $request): array
    {
        $filters = $request->validate(['period' => ['nullable', Rule::in(['day', 'week', 'month'])], 'offset' => ['nullable', 'integer', 'between:-120,120'], 'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from']]);
        $period = $filters['period'] ?? 'week';
        $offset = (int) ($filters['offset'] ?? 0);
        $anchor = today();
        [$from,$to] = match ($period) {
            'day' => [$anchor->copy()->addDays($offset), $anchor->copy()->addDays($offset)],
            'month' => [$anchor->copy()->addMonthsNoOverflow($offset)->startOfMonth(), $anchor->copy()->addMonthsNoOverflow($offset)->endOfMonth()],
            default => [$anchor->copy()->addWeeks($offset)->startOfWeek(), $anchor->copy()->addWeeks($offset)->endOfWeek()],
        };
        if (! empty($filters['from'])) {
            $from = Carbon::parse($filters['from']);
        }
        if (! empty($filters['to'])) {
            $to = Carbon::parse($filters['to']);
        }
        if ($from->gt($to) || $from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['from' => 'Rentang tanggal harus berurutan, maksimal 366 hari.']);
        }
        $transactions = $request->user()->transactions()->whereDate('occurred_on', '>=', $from->toDateString())->whereDate('occurred_on', '<=', $to->toDateString())->orderBy('occurred_on')->orderBy('id')->get();
        $days = collect();
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $date = $day->toDateString();
            $days->push(['date' => $day->copy(), ...self::summary($transactions->filter(fn ($tx) => $tx->occurred_on->toDateString() === $date))]);
        }
        $categories = $transactions->where('type', 'out')->groupBy('category')->map->sum('amount')->sortDesc();
        $wasteCost = (int) $request->user()->wasteLogs()->whereDate('occurred_on', '>=', $from->toDateString())->whereDate('occurred_on', '<=', $to->toDateString())->sum('cost');

        return compact('period', 'offset', 'from', 'to', 'transactions', 'days', 'categories', 'wasteCost') + ['summary' => self::summary($transactions)];
    }
}
