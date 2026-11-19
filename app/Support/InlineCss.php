<?php

declare(strict_types=1);

namespace App\Support;

/**
 * public/css/app.css disisipkan langsung ke <style> di layout agar halaman tampil tanpa menunggu
 * request CSS kedua (render-blocking). CSP tetap tanpa 'unsafe-inline': hanya <style> dengan isi
 * persis file ini yang diizinkan, lewat hash SHA-256 yang dihitung dari file yang sama.
 */
class InlineCss
{
    /** @var array{0: int, 1: string, 2: string}|null [filemtime, isi, hash] */
    private static ?array $cache = null;

    public static function content(): string
    {
        return self::load()[1];
    }

    /** Nilai sumber CSP, mis. 'sha256-AbC...='. */
    public static function hashSource(): string
    {
        return "'".self::load()[2]."'";
    }

    /**
     * @return array{0: int, 1: string, 2: string}
     */
    private static function load(): array
    {
        $path = public_path('css/app.css');
        $mtime = (int) @filemtime($path);

        if (self::$cache === null || self::$cache[0] !== $mtime) {
            $css = (string) @file_get_contents($path);
            self::$cache = [$mtime, $css, 'sha256-'.base64_encode(hash('sha256', $css, true))];
        }

        return self::$cache;
    }
}
