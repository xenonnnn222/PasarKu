<?php

namespace Tests\Feature;

use App\Models\DebtPayment;
use App\Models\User;
use App\Services\DemoData;
use App\Support\Bookkeeping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BookkeepingTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::factory()->create();
    }

    private function tx(array $override = []): array
    {
        return array_replace(['type' => 'in', 'amount' => 200000, 'category' => 'Penjualan', 'note' => 'Penjualan pagi', 'occurred_on' => today()->toDateString()], $override);
    }

    private function debt(User $user, array $override = [])
    {
        return $user->debts()->create(array_replace(['type' => 'piutang', 'party' => 'Bu Tejo', 'phone' => '081322445566', 'total' => 100000, 'paid' => 0, 'due_date' => today()->addWeek(), 'note' => 'Pembelian sayur'], $override));
    }

    private function product(User $user, array $override = [])
    {
        return $user->products()->create(array_replace(['name' => 'Tomat', 'unit' => 'kg', 'stock' => 1.5, 'min_stock' => 2, 'buy_price' => 10000, 'sell_price' => 15000], $override));
    }

    public function test_guests_are_redirected_and_login_is_server_rendered(): void
    {
        $this->get('/')->assertRedirect(route('login'));
        $this->get('/login')->assertOk()->assertSee('Masuk ke ruang usaha')->assertSee('name="_token"', false)->assertSee('/css/app.css', false);
        $this->get('/mulai')->assertOk()->assertSee('Kenali uang Anda.');
        $this->get('/up')->assertOk();
    }

    public function test_registration_hashes_pin_normalizes_phone_and_does_not_seed_real_accounts(): void
    {
        $this->post('/daftar', ['name' => 'Bu Ani', 'business_name' => 'Lapak Ani', 'phone' => '+62 812-3456-7890', 'pin' => '4321', 'pin_confirmation' => '4321', 'starting_cash' => 250000])->assertRedirect(route('home'));
        $user = User::firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('081234567890', $user->phone);
        $this->assertTrue(Hash::check('4321', $user->password));
        $this->assertNotSame('4321', $user->password);
        $this->assertSame(0, $user->transactions()->count());
    }

    public function test_login_rejects_wrong_pin_and_accepts_the_registered_pin(): void
    {
        $user = $this->user();
        $this->post('/login', ['phone' => $user->phone, 'pin' => '9999'])->assertSessionHasErrors('phone');
        $this->assertGuest();
        $this->post('/login', ['phone' => $user->phone, 'pin' => '1234'])->assertRedirect(route('home'));
        $this->assertAuthenticatedAs($user);
        $this->post('/logout')->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_login_is_rate_limited_and_pin_is_not_flashed(): void
    {
        $user = $this->user();
        for ($i = 0; $i < 5; $i++) {
            $this->post('/login', ['phone' => $user->phone, 'pin' => '0000'])->assertSessionHasErrors('phone');
        }
        $this->assertArrayNotHasKey('pin', session()->getOldInput());
        $this->post('/login', ['phone' => $user->phone, 'pin' => '0000'])->assertStatus(429);
    }

    public function test_csrf_is_enforced_outside_the_test_environment(): void
    {
        $this->app['env'] = 'production';
        $this->post('/login', ['phone' => '081234567890', 'pin' => '1234'])->assertStatus(419);
    }

    public function test_every_feature_page_renders_with_demo_data(): void
    {
        $this->withoutExceptionHandling();
        $user = $this->user();
        app(DemoData::class)->populate($user);
        $this->actingAs($user);
        foreach (['/', '/catat', '/riwayat', '/kasbon', '/stok', '/laporan', '/pengaturan'] as $url) {
            $this->get($url)->assertOk()->assertSee('PasarKu')->assertSee('name="_token"', false);
        }
    }

    public function test_demo_accounts_are_isolated_between_visitors(): void
    {
        $this->post('/demo')->assertRedirect(route('home'));
        $first = auth()->user();
        $this->assertTrue($first->is_demo);
        $this->assertSame(12, $first->products()->count());
        $this->post('/logout');
        $this->post('/demo')->assertRedirect(route('home'));
        $second = auth()->user();
        $this->assertNotSame($first->id, $second->id);
        $this->assertSame(12, $second->products()->count());
    }

    public function test_cash_and_profit_treat_prive_differently(): void
    {
        $user = $this->user();
        $this->actingAs($user);
        $this->post('/transaksi', $this->tx())->assertSessionHasNoErrors();
        $this->post('/transaksi', $this->tx(['type' => 'out', 'amount' => 75000, 'category' => 'Belanja modal']))->assertSessionHasNoErrors();
        $this->post('/transaksi', $this->tx(['type' => 'out', 'amount' => 50000, 'category' => 'Pribadi (prive)']))->assertSessionHasNoErrors();
        $this->assertSame(575000, Bookkeeping::cash($user));
        $this->assertSame(125000, Bookkeeping::summary($user->transactions()->get())['profit']);
        $this->get('/')->assertSee('Rp 575.000')->assertSee('Rp 125.000');
    }

    public function test_manual_transactions_can_be_edited_deleted_and_validate_type_and_amount(): void
    {
        $user = $this->user();
        $this->actingAs($user);
        $this->post('/transaksi', $this->tx(['amount' => 0]))->assertSessionHasErrors('amount');
        $this->post('/transaksi', $this->tx(['type' => 'out']))->assertSessionHasErrors('category');
        $this->post('/transaksi', $this->tx())->assertSessionHasNoErrors();
        $tx = $user->transactions()->firstOrFail();
        $this->get('/transaksi/'.$tx->id.'/ubah')->assertOk();
        $this->put('/transaksi/'.$tx->id, $this->tx(['amount' => 90000]))->assertSessionHasNoErrors();
        $this->assertSame(90000, $tx->fresh()->amount);
        $this->delete('/transaksi/'.$tx->id)->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('transactions', ['id' => $tx->id]);
    }

    public function test_unpaid_sale_creates_receivable_without_changing_cash(): void
    {
        $user = $this->user();
        $this->actingAs($user)->post('/transaksi', $this->tx(['unpaid' => 1, 'party' => 'Bu Tejo', 'due_date' => today()->addWeek()->toDateString()]))->assertRedirect(route('debts.index'));
        $this->assertSame(0, $user->transactions()->count());
        $this->assertSame(200000, $user->debts()->firstOrFail()->total);
        $this->assertSame(500000, Bookkeeping::cash($user));
    }

    public function test_receivable_payment_updates_debt_cash_and_payment_history_together(): void
    {
        $user = $this->user();
        $debt = $this->debt($user);
        $this->actingAs($user)->post('/kasbon/'.$debt->id.'/bayar', ['amount' => 40000, 'paid_at' => today()->toDateString()])->assertSessionHasNoErrors();
        $this->assertSame(40000, $debt->fresh()->paid);
        $this->assertSame(60000, $debt->fresh()->remaining);
        $this->assertSame(540000, Bookkeeping::cash($user));
        $tx = $user->transactions()->firstOrFail();
        $this->assertSame('in', $tx->type);
        $this->assertSame('debt_payment', $tx->source);
        $this->assertDatabaseHas('debt_payments', ['debt_id' => $debt->id, 'transaction_id' => $tx->id, 'amount' => 40000]);
        $this->delete('/transaksi/'.$tx->id)->assertStatus(422);
        $this->get('/transaksi/'.$tx->id.'/ubah')->assertStatus(422);
    }

    public function test_overpayments_are_rejected_without_partial_writes(): void
    {
        $user = $this->user();
        $debt = $this->debt($user, ['paid' => 70000]);
        $this->actingAs($user)->post('/kasbon/'.$debt->id.'/bayar', ['amount' => 40000, 'paid_at' => today()->toDateString()])->assertSessionHasErrors('amount');
        $this->assertSame(70000, $debt->fresh()->paid);
        $this->assertSame(0, $user->transactions()->count());
        $this->assertSame(0, DebtPayment::count());
    }

    public function test_supplier_payment_reduces_cash(): void
    {
        $user = $this->user();
        $debt = $this->debt($user, ['type' => 'utang']);
        $this->actingAs($user)->post('/kasbon/'.$debt->id.'/bayar', ['amount' => 25000, 'paid_at' => today()->toDateString(), 'note' => 'Tunai'])->assertSessionHasNoErrors();
        $this->assertSame(475000, Bookkeeping::cash($user));
        $this->assertDatabaseHas('transactions', ['user_id' => $user->id, 'type' => 'out', 'category' => 'Bayar utang', 'amount' => 25000]);
    }

    public function test_paid_debt_cannot_be_deleted_or_changed_to_another_kind(): void
    {
        $user = $this->user();
        $debt = $this->debt($user, ['paid' => 20000]);
        $this->actingAs($user);
        $this->delete('/kasbon/'.$debt->id)->assertSessionHasErrors('debt');
        $this->put('/kasbon/'.$debt->id, ['type' => 'utang', 'party' => 'Bu Tejo', 'total' => 100000, 'due_date' => today()->toDateString()])->assertSessionHasErrors('type');
        $this->assertDatabaseHas('debts', ['id' => $debt->id, 'type' => 'piutang']);
    }

    public function test_restock_and_waste_adjust_stock_and_expenses_correctly(): void
    {
        $user = $this->user();
        $product = $this->product($user);
        $this->actingAs($user);
        $this->post('/stok/'.$product->id.'/masuk', ['qty' => 2.5, 'buy_price' => 12000, 'record_expense' => 1])->assertSessionHasNoErrors();
        $this->assertSame('4.00', $product->fresh()->stock);
        $this->assertDatabaseHas('transactions', ['user_id' => $user->id, 'type' => 'out', 'amount' => 30000, 'category' => 'Belanja modal']);
        $this->post('/stok/'.$product->id.'/susut', ['qty' => 1.25, 'reason' => 'Busuk / Layu'])->assertSessionHasNoErrors();
        $this->assertSame('2.75', $product->fresh()->stock);
        $this->assertDatabaseHas('waste_logs', ['product_id' => $product->id, 'cost' => 15000]);
        $this->post('/stok/'.$product->id.'/susut', ['qty' => 3, 'reason' => 'Busuk / Layu'])->assertSessionHasErrors('qty');
        $this->assertSame('2.75', $product->fresh()->stock);
    }

    public function test_negative_stock_and_excessive_restock_value_are_rejected(): void
    {
        $user = $this->user();
        $product = $this->product($user, ['stock' => 0.5]);
        $this->actingAs($user);
        $this->post('/stok/'.$product->id.'/sesuaikan', ['delta' => -1])->assertSessionHasErrors('stock');
        $this->post('/stok/'.$product->id.'/masuk', ['qty' => 10000000, 'buy_price' => 1000000000000, 'record_expense' => 1])->assertSessionHasErrors('qty');
        $this->assertSame('0.50', $product->fresh()->stock);
        $this->assertSame(0, $user->transactions()->count());
    }

    public function test_a_user_cannot_read_or_modify_another_users_financial_records(): void
    {
        $owner = $this->user();
        $outsider = $this->user();
        $tx = $owner->transactions()->create($this->tx());
        $debt = $this->debt($owner);
        $product = $this->product($owner);
        $this->actingAs($outsider);
        $this->get('/transaksi/'.$tx->id.'/ubah')->assertNotFound();
        $this->put('/transaksi/'.$tx->id, $this->tx())->assertNotFound();
        $this->delete('/transaksi/'.$tx->id)->assertNotFound();
        $this->post('/kasbon/'.$debt->id.'/bayar', ['amount' => 10000, 'paid_at' => today()->toDateString()])->assertNotFound();
        $this->delete('/kasbon/'.$debt->id)->assertNotFound();
        $this->post('/stok/'.$product->id.'/sesuaikan', ['delta' => 1])->assertNotFound();
        $this->delete('/stok/'.$product->id)->assertNotFound();
        $this->get('/riwayat')->assertDontSee('Penjualan pagi');
    }

    public function test_search_and_date_filters_exclude_other_records(): void
    {
        $user = $this->user();
        $user->transactions()->create($this->tx(['note' => 'Transaksi hari ini']));
        $user->transactions()->create($this->tx(['note' => 'Transaksi lampau', 'occurred_on' => today()->subMonth()->toDateString()]));
        $this->actingAs($user)->get('/riwayat?from='.today()->toDateString().'&q=hari')->assertOk()->assertSee('Transaksi hari ini')->assertDontSee('Transaksi lampau');
    }

    public function test_reports_and_csv_use_the_selected_period_and_escape_spreadsheet_formulas(): void
    {
        $user = $this->user();
        $user->transactions()->create($this->tx(['note' => '=2+3']));
        $user->transactions()->create($this->tx(['note' => 'Di luar periode', 'occurred_on' => today()->subMonth()->toDateString()]));
        $other = $this->user();
        $other->transactions()->create($this->tx(['note' => 'Rahasia pengguna lain']));
        $this->actingAs($user)->get('/laporan?period=day')->assertOk()->assertSee('Rp 200.000')->assertDontSee('Di luar periode')->assertDontSee('Rahasia pengguna lain');
        $response = $this->get('/laporan/csv?period=day')->assertOk()->assertDownload();
        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString("'=2+3", $csv);
        $this->assertStringNotContainsString('Di luar periode', $csv);
        $this->assertStringNotContainsString('Rahasia pengguna lain', $csv);
    }

    public function test_notes_are_html_escaped(): void
    {
        $user = $this->user();
        $user->transactions()->create($this->tx(['note' => '<script>alert(1)</script>']));
        $this->actingAs($user)->get('/riwayat')->assertOk()->assertSee('&lt;script&gt;', false)->assertDontSee('<script>alert(1)</script>', false);
    }

    public function test_invalid_or_oversized_report_ranges_are_rejected(): void
    {
        $this->actingAs($this->user())->get('/laporan?from=2020-01-01&to=2026-01-01')->assertSessionHasErrors('from');
        $this->get('/laporan?from=2026-10-29&to=2026-01-01')->assertSessionHasErrors('to');
    }

    public function test_json_backup_round_trip_preserves_balances_and_history(): void
    {
        $source = $this->user();
        app(DemoData::class)->populate($source);
        $backup = $this->actingAs($source)->get('/pengaturan/cadangan')->assertOk()->streamedContent();
        $this->assertStringNotContainsString('"pin"', $backup);
        $this->assertStringNotContainsString('password', $backup);
        $target = $this->user();
        $this->actingAs($target)->post('/pengaturan/impor', ['payload' => $backup])->assertSessionHasNoErrors();
        $this->assertSame($source->transactions()->count(), $target->transactions()->count());
        $this->assertSame(12, $target->products()->count());
        $this->assertSame(Bookkeeping::cash($source), Bookkeeping::cash($target->fresh()));
        $this->assertSame(1, $target->debts()->withCount('payments')->get()->sum('payments_count'));
    }

    public function test_import_is_atomic_for_bad_data_and_refuses_nonempty_accounts(): void
    {
        $user = $this->user();
        $payload = ['settings' => [], 'transactions' => [$this->tx() + ['id' => 'legacy-tx', 'date' => today()->toDateString()]], 'products' => [], 'debts' => [['id' => 'bad', 'type' => 'piutang', 'party' => 'Pelanggan', 'total' => 100, 'paid' => 200, 'dueDate' => today()->toDateString()]], 'wasteLogs' => []];
        $this->actingAs($user)->post('/pengaturan/impor', ['payload' => json_encode($payload)])->assertSessionHasErrors('import');
        $this->assertSame(0, $user->transactions()->count());
        $this->assertSame(0, $user->debts()->count());
        $user->transactions()->create($this->tx());
        $this->post('/pengaturan/impor', ['payload' => json_encode(['transactions' => [], 'debts' => [], 'products' => [], 'wasteLogs' => []])])->assertSessionHasErrors('import');
        $this->assertSame(1, $user->transactions()->count());
    }

    public function test_empty_backup_can_be_imported(): void
    {
        $user = $this->user();
        $this->actingAs($user)->post('/pengaturan/impor', ['payload' => json_encode(['settings' => ['startingCash' => 125000], 'transactions' => [], 'debts' => [], 'products' => [], 'wasteLogs' => []])])->assertSessionHasNoErrors();
        $this->assertSame(125000, $user->fresh()->starting_cash);
    }

    public function test_clear_requires_confirmation_and_affects_only_current_user(): void
    {
        $user = $this->user();
        $other = $this->user();
        $user->transactions()->create($this->tx());
        $other->transactions()->create($this->tx());
        $this->actingAs($user);
        $this->delete('/pengaturan/data')->assertSessionHasErrors('confirmation');
        $this->assertSame(1, $user->transactions()->count());
        $this->delete('/pengaturan/data', ['confirmation' => 'HAPUS'])->assertSessionHasNoErrors();
        $this->assertSame(0, $user->transactions()->count());
        $this->assertSame(1, $other->transactions()->count());
        $this->assertSame(0, $user->fresh()->starting_cash);
    }

    public function test_pin_change_checks_current_pin_and_stores_a_hash(): void
    {
        $user = $this->user();
        $this->actingAs($user);
        $this->put('/pengaturan/pin', ['current_pin' => '9999', 'pin' => '5678', 'pin_confirmation' => '5678'])->assertSessionHasErrors('current_pin');
        $this->put('/pengaturan/pin', ['current_pin' => '1234', 'pin' => '5678', 'pin_confirmation' => '5678'])->assertSessionHasNoErrors();
        $this->assertTrue(Hash::check('5678', $user->fresh()->password));
    }
}
