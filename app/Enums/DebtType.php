<?php

declare(strict_types=1);

namespace App\Enums;

enum DebtType: string
{
    case Receivable = 'piutang';
    case Payable = 'utang';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
