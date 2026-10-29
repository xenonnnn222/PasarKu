<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DemoData;
use App\Services\LegacyData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class MigrationRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_includes_both_boundary_dates_and_waste_on_the_last_day(): void
    {
        $user = User::factory()->create();
        foreach (['2026-10-28', '2026-10-29'] as $date) {
            $user->transactions()->create(['type' => 'in', 'amount' => 10000, 'category' => 'Penjualan', 'occurred_on' => $date]);
        }
        $user->wasteLogs()->create(['qty' => 1, 'reason' => 'Busuk / Layu', 'cost' => 3500, 'occurred_on' => '2026-10-29']);
        $this->actingAs($user)->get('/laporan?from=2026-10-28&to=2026-10-29')
            ->assertOk()->assertViewHas('summary', fn ($summary) => $summary['income'] === 20000)
            ->assertViewHas('wasteCost', 3500);
    }

    public function test_dashboard_chart_includes_today(): void
    {
        $user = User::factory()->create();
        $user->transactions()->create(['type' => 'in', 'amount' => 12345, 'category' => 'Penjualan', 'occurred_on' => today()]);
        $this->actingAs($user)->get('/')->assertOk()->assertViewHas('chart', fn ($days) => $days->last()['income'] === 12345);
    }

    public function test_product_forms_support_create_update_and_delete_without_losing_waste_history(): void
    {
        $user = User::factory()->create();
        $data = ['name' => 'Bawang merah', 'unit' => 'kg', 'stock' => 5.25, 'min_stock' => 2, 'buy_price' => 15000, 'sell_price' => 18000];
        $this->actingAs($user)->post('/stok', $data)->assertSessionHasNoErrors();
        $product = $user->products()->firstOrFail();
        $this->put('/stok/'.$product->id, array_replace($data, ['name' => 'Bawang Brebes', 'stock' => 999]))->assertSessionHasNoErrors();
        $this->assertSame('Bawang Brebes', $product->fresh()->name);
        $this->assertSame('5.25', $product->fresh()->stock);
        $this->post('/stok/'.$product->id.'/susut', ['qty' => 0.25, 'reason' => 'Busuk / Layu'])->assertSessionHasNoErrors();
        $this->delete('/stok/'.$product->id)->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('products', ['id' => $product->id]);
        $this->assertDatabaseHas('waste_logs', ['user_id' => $user->id, 'product_id' => null, 'cost' => 3750]);
    }

    public function test_profile_preferences_are_saved_and_phone_uniqueness_is_checked(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $data = ['name' => 'Bu Wati', 'business_name' => 'Lapak Wati', 'phone' => $other->phone, 'starting_cash' => 750000, 'theme' => 'dark', 'font_size' => 'large'];
        $this->actingAs($user)->put('/pengaturan', $data)->assertSessionHasErrors('phone');
        $data['phone'] = $user->phone;
        $this->put('/pengaturan', $data)->assertSessionHasNoErrors();
        $this->get('/pengaturan')->assertOk()->assertSee('data-theme="dark"', false)->assertSee('data-font="large"', false)->assertSee('Lapak Wati');
    }

    public function test_uploaded_json_backup_can_be_restored(): void
    {
        $user = User::factory()->create();
        $json = json_encode(['settings' => ['startingCash' => 150000], 'transactions' => [], 'products' => [], 'debts' => [], 'wasteLogs' => []]);
        $file = UploadedFile::fake()->createWithContent('pasarku.json', $json);
        $this->actingAs($user)->post('/pengaturan/impor', ['backup' => $file])->assertSessionHasNoErrors();
        $this->assertSame(150000, $user->fresh()->starting_cash);
    }

    public function test_reset_demo_data_preserves_the_account_and_other_users_data(): void
    {
        $user = User::factory()->create(['name' => 'Pemilik asli']);
        $other = User::factory()->create();
        app(DemoData::class)->populate($other);
        $phone = $user->phone;
        $this->actingAs($user)->post('/pengaturan/reset', ['confirmation' => 'HAPUS'])->assertSessionHasNoErrors();
        $this->assertSame('Pemilik asli', $user->fresh()->name);
        $this->assertSame($phone, $user->fresh()->phone);
        $this->assertSame(12, $user->products()->count());
        $this->assertSame(12, $other->products()->count());
    }

    public function test_restock_transaction_source_survives_backup_and_restore(): void
    {
        $source = User::factory()->create();
        $source->transactions()->create(['type' => 'out', 'source' => 'restock', 'amount' => 25000, 'category' => 'Belanja modal', 'occurred_on' => today()]);
        $target = User::factory()->create();
        $legacy = app(LegacyData::class);
        $legacy->import($target, $legacy->export($source));
        $transaction = $target->transactions()->firstOrFail();
        $this->assertSame('restock', $transaction->source);
        $this->actingAs($target)->delete('/transaksi/'.$transaction->id)->assertStatus(422);
    }
}
