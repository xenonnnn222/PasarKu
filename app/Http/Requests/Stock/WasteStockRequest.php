<?php

declare(strict_types=1);

namespace App\Http\Requests\Stock;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WasteStockRequest extends FormRequest
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
            'reason' => ['required', Rule::in(Bookkeeping::WASTE_REASONS)],
        ];
    }
}
