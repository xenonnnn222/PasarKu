<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\InlineCss;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Semua skrip berasal dari aplikasi sendiri; tidak ada script atau atribut style inline.
     * Satu-satunya <style> adalah isi app.css (App\Support\InlineCss), diizinkan lewat hash-nya.
     * Grafik dan progress bar memakai kelas .w-N / .h-N di app.css, bukan atribut style.
     */
    private const CONTENT_SECURITY_POLICY = "default-src 'self'; "
        ."script-src 'self'; "
        ."style-src 'self' {style-hash}; "
        ."img-src 'self' data:; "
        ."font-src 'self'; "
        ."connect-src 'self'; "
        ."object-src 'none'; "
        ."base-uri 'self'; "
        ."form-action 'self'; "
        ."frame-ancestors 'self'";

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Content-Security-Policy', str_replace('{style-hash}', InlineCss::hashSource(), self::CONTENT_SECURITY_POLICY));
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        // Hanya dikirim lewat HTTPS; browser lalu menolak versi HTTP domain ini selama setahun.
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
