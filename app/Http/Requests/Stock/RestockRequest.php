<?php

declare(strict_types=1);

namespace App\Http\Requests\Stock;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;

class RestockRequest extends FormRequest
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
            'qty' => ['required', 'numeric', 'gt:0', 'max:10000000', 'decimal:0,2'],
            'buy_price' => ['required', 'integer', 'min:0', 'max:'.Bookkeeping::MAX_MONEY],
        ];
    }
}
