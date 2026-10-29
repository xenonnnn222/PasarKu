<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return ['name' => fake()->name(), 'business_name' => 'Lapak '.fake()->firstName(), 'phone' => fake()->unique()->numerify('0812########'), 'password' => Hash::make('1234'), 'starting_cash' => 500000];
    }
}
