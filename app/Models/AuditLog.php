<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;

/**
 * Jejak aktivitas admin (checklist OWASP G3). Disimpan di tabel audit_logs dan juga
 * ditulis ke channel log 'security' agar ikut dipantau skrip monitoring.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'action', 'target_user_id', 'ip', 'details'];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @param  array<string, mixed>  $details
     */
    public static function record(?User $actor, string $action, ?User $target = null, array $details = []): self
    {
        $ip = request()->route() !== null ? request()->ip() : 'cli';

        $entry = self::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'target_user_id' => $target?->id,
            'ip' => $ip,
            'details' => $details ?: null,
        ]);

        Log::channel('security')->notice('Aktivitas admin action='.$action, [
            'actor_id' => $actor?->id,
            'target_user_id' => $target?->id,
            'ip' => $ip,
            ...$details,
        ]);

        return $entry;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
