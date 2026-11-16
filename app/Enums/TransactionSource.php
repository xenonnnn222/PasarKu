<?php

declare(strict_types=1);

namespace App\Enums;

enum TransactionSource: string
{
    case Manual = 'manual';
    case Restock = 'restock';
    case DebtPayment = 'debt_payment';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
