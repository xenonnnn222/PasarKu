<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ProductPolicy
{
    public function manage(User $user, Product $product): Response
    {
        return $user->id === $product->user_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
