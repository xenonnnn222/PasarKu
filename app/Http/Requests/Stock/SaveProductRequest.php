<?php

declare(strict_types=1);

namespace App\Http\Requests\Stock;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveProductRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            'unit' => ['required', Rule::in(Bookkeeping::UNITS)],
            'stock' => ['required', 'numeric', 'min:0', 'max:10000000', 'decimal:0,2'],
            'min_stock' => ['required', 'numeric', 'min:0', 'max:10000000', 'decimal:0,2'],
            'buy_price' => ['required', 'integer', 'min:0', 'max:'.Bookkeeping::MAX_MONEY],
            'sell_price' => ['required', 'integer', 'min:0', 'max:'.Bookkeeping::MAX_MONEY],
        ];
    }
}
