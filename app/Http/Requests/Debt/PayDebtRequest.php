<?php

declare(strict_types=1);

namespace App\Http\Requests\Debt;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;

class PayDebtRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:'.Bookkeeping::MAX_MONEY],
            'paid_at' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
