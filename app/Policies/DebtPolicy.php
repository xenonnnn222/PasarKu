<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Debt;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class DebtPolicy
{
    public function manage(User $user, Debt $debt): Response
    {
        return $user->id === $debt->user_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
