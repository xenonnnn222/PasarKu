<?php

declare(strict_types=1);

namespace App\Http\Requests\Debt;

use App\Enums\DebtType;
use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveDebtRequest extends FormRequest
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
            'type' => ['required', Rule::in(DebtType::values())],
            'party' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:25'],
            'total' => ['required', 'integer', 'min:1', 'max:'.Bookkeeping::MAX_MONEY],
            'due_date' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
