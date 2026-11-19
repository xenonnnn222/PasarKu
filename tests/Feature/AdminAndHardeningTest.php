<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\DemoData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAndHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin]);
    }

    public function test_new_accounts_are_owners_and_role_cannot_be_mass_assigned(): void
    {
        $this->post('/daftar', ['name' => 'Bu Ani', 'business_name' => 'Lapak Ani', 'phone' => '081311112222', 'starting_cash' => 0, 'pin' => '1234', 'pin_confirmation' => '1234', 'role' => 'admin'])
            ->assertRedirect(route('home'));
        $user = User::where('phone', '081311112222')->firstOrFail();
        $this->assertSame(UserRole::Owner, $user->role);

        $this->put('/pengaturan', ['name' => 'Bu Ani', 'business_name' => 'Lapak Ani', 'phone' => '081311112222', 'starting_cash' => 0, 'theme' => 'light', 'font_size' => 'normal', 'role' => 'admin', 'disabled_at' => null]);
        $this->assertSame(UserRole::Owner, $user->fresh()->role);
        $this->get('/admin')->assertForbidden();
    }

    public function test_owner_and_demo_accounts_cannot_open_the_admin_panel(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden()->assertSee('Akses ditolak');
        $demoAdmin = User::factory()->create(['is_demo' => true, 'role' => UserRole::Admin]);
        $this->actingAs($demoAdmin)->get('/admin')->assertForbidden();
        $this->post('/admin/akun/'.$demoAdmin->id.'/nonaktifkan')->assertForbidden();
        $this->assertSame(0, AuditLog::count());
    }

    public function test_admin_actions_are_recorded_and_disabled_accounts_are_locked_out(): void
    {
        $admin = $this->admin();
        $owner = User::factory()->create(['phone' => '081255556666']);
        app(DemoData::class)->populate($owner);

        $this->actingAs($admin)->get('/admin')->assertOk()
            ->assertSee($owner->business_name)
            ->assertSee('0812*****666')
            ->assertDontSee('081255556666')
            ->assertDontSee('Rp ');

        $this->post('/admin/akun/'.$owner->id.'/nonaktifkan')->assertRedirect();
        $this->assertNotNull($owner->fresh()->disabled_at);

        $this->assertDatabaseHas('audit_logs', ['actor_id' => $admin->id, 'action' => 'admin.view_accounts']);
        $this->assertDatabaseHas('audit_logs', ['actor_id' => $admin->id, 'action' => 'admin.disable_account', 'target_user_id' => $owner->id, 'ip' => '127.0.0.1']);

        // Sesi aktif milik akun yang dinonaktifkan langsung diakhiri.
        $this->actingAs($owner->fresh())->get('/')->assertRedirect(route('login'));
        $this->assertGuest();

        // Login dengan PIN benar tetap ditolak, dengan pesan generik.
        $this->post('/login', ['phone' => '081255556666', 'pin' => '1234'])->assertSessionHasErrors('phone');
        $this->assertGuest();

        $this->actingAs($admin)->post('/admin/akun/'.$owner->id.'/aktifkan')->assertRedirect();
        $this->assertNull($owner->fresh()->disabled_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.enable_account', 'target_user_id' => $owner->id]);
        $this->post('/logout');
        $this->post('/login', ['phone' => '081255556666', 'pin' => '1234'])->assertRedirect(route('home'));
    }

    public function test_admin_cannot_disable_itself_or_another_admin(): void
    {
        $admin = $this->admin();
        $other = $this->admin();
        $this->actingAs($admin)->post('/admin/akun/'.$admin->id.'/nonaktifkan')->assertForbidden();
        $this->post('/admin/akun/'.$other->id.'/nonaktifkan')->assertForbidden();
        $this->assertNull($other->fresh()->disabled_at);
    }

    public function test_role_command_changes_role_and_is_audited(): void
    {
        $user = User::factory()->create(['phone' => '081277778888']);
        $this->artisan('pasarku:role', ['phone' => '+62 812-7777-8888', 'role' => 'admin'])->assertSuccessful();
        $this->assertSame(UserRole::Admin, $user->fresh()->role);
        $this->assertDatabaseHas('audit_logs', ['actor_id' => null, 'action' => 'cli.change_role', 'target_user_id' => $user->id, 'ip' => 'cli']);
        $this->artisan('pasarku:role', ['phone' => '081277778888', 'role' => 'superuser'])->assertFailed();
    }

    public function test_csp_has_no_unsafe_inline_and_only_hashed_styles_are_allowed(): void
    {
        $csp = (string) $this->get('/login')->headers->get('Content-Security-Policy');
        $this->assertStringNotContainsString('unsafe-inline', $csp);
        $this->assertStringContainsString("style-src 'self' 'sha256-", $csp);

        $user = User::factory()->create();
        app(DemoData::class)->populate($user);
        $this->actingAs($user);
        foreach (['/', '/riwayat', '/kasbon', '/stok', '/laporan', '/pengaturan', '/admin'] as $url) {
            if ($url === '/admin') {
                $user->forceFill(['role' => UserRole::Admin])->save();
            }
            $response = $this->get($url);
            $html = $response->assertOk()->getContent();
            $this->assertDoesNotMatchRegularExpression('/\sstyle\s*=/i', $html, $url);
            $this->assertStyleBlocksMatchCsp($html, (string) $response->headers->get('Content-Security-Policy'), $url);
        }

        $notFound = $this->get('/halaman-yang-tidak-ada')->assertNotFound();
        $notFound->assertSee('Halaman tidak ditemukan');
        $this->assertDoesNotMatchRegularExpression('/\sstyle\s*=/i', $notFound->getContent());
    }

    private function assertStyleBlocksMatchCsp(string $html, string $csp, string $url): void
    {
        preg_match_all('#<style>(.*?)</style>#s', $html, $blocks);
        $this->assertCount(1, $blocks[1], $url);
        foreach ($blocks[1] as $css) {
            $this->assertStringContainsString("'sha256-".base64_encode(hash('sha256', $css, true))."'", $csp, $url);
        }
    }
}
