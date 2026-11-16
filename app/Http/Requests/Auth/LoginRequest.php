<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Support\Bookkeeping;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
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
            'phone' => ['required', 'string', 'max:20'],
            'pin' => ['required', 'regex:/^\d{4}$/'],
        ];
    }
}
