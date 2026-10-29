<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('type');
            $t->string('party');
            $t->string('phone')->nullable();
            $t->unsignedBigInteger('total');
            $t->unsignedBigInteger('paid')->default(0);
            $t->date('due_date');
            $t->text('note')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'due_date']);
        });
        Schema::create('transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('debt_id')->nullable()->constrained()->nullOnDelete();
            $t->string('source')->default('manual');
            $t->string('type');
            $t->unsignedBigInteger('amount');
            $t->string('category');
            $t->text('note')->nullable();
            $t->date('occurred_on');
            $t->timestamps();
            $t->index(['user_id', 'occurred_on']);
        });
        Schema::create('debt_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('debt_id')->constrained()->cascadeOnDelete();
            $t->foreignId('transaction_id')->nullable()->unique()->constrained()->nullOnDelete();
            $t->unsignedBigInteger('amount');
            $t->date('paid_at');
            $t->text('note')->nullable();
            $t->timestamps();
        });
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('unit');
            $t->decimal('stock', 14, 2)->default(0);
            $t->decimal('min_stock', 14, 2)->default(0);
            $t->unsignedBigInteger('buy_price')->default(0);
            $t->unsignedBigInteger('sell_price')->default(0);
            $t->timestamps();
        });
        Schema::create('waste_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('qty', 14, 2);
            $t->string('reason');
            $t->unsignedBigInteger('cost')->default(0);
            $t->date('occurred_on');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['waste_logs', 'products', 'debt_payments', 'transactions', 'debts'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
