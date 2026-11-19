<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role', 20)->default('pemilik')->after('phone');
            $t->timestamp('disabled_at')->nullable()->after('is_demo');
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 60);
            $t->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('ip', 45)->nullable();
            $t->json('details')->nullable();
            $t->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn(['role', 'disabled_at']);
        });
    }
};
