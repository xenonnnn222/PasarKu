<?php

declare(strict_types=1);

namespace App\Http\Requests\Transaction;

use App\Enums\TransactionType;
use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveTransactionRequest extends FormRequest
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
        $categories = $this->input('type') === TransactionType::In->value
            ? Bookkeeping::INCOME
            : Bookkeeping::EXPENSE;

        return [
            'type' => ['required', Rule::in(TransactionType::values())],
            'amount' => ['required', 'integer', 'min:1', 'max:'.Bookkeeping::MAX_MONEY],
            'category' => ['required', Rule::in($categories)],
            'note' => ['nullable', 'string', 'max:1000'],
            'occurred_on' => ['required', 'date_format:Y-m-d'],
        ];
    }
}
