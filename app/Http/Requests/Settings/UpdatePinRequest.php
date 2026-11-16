<?php

declare(strict_types=1);

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePinRequest extends FormRequest
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
            'current_pin' => ['required', 'string'],
            'pin' => ['required', 'regex:/^\d{4}$/', 'confirmed'],
        ];
    }
}
