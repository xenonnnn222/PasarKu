<?php

declare(strict_types=1);

namespace App\Http\Requests\Settings;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'phone' => Bookkeeping::phone((string) $this->input('phone')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'business_name' => ['required', 'string', 'max:150'],
            'phone' => [
                'required',
                'regex:/^08[1-9][0-9]{7,10}$/',
                Rule::unique('users', 'phone')->ignore($this->user()?->id),
            ],
            'starting_cash' => ['required', 'integer', 'min:0', 'max:'.Bookkeeping::MAX_MONEY],
            'theme' => ['required', Rule::in(['light', 'dark'])],
            'font_size' => ['required', Rule::in(['normal', 'large'])],
        ];
    }
}
