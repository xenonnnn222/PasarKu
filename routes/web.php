<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::view('/mulai', 'onboarding')->name('onboarding');
    Route::get('/login', [AuthController::class, 'loginForm'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login')->name('login.store');
    Route::get('/daftar', [AuthController::class, 'registerForm'])->name('register');
    Route::post('/daftar', [AuthController::class, 'register'])->middleware('throttle:registration')->name('register.store');
    Route::post('/demo', [AuthController::class, 'demo'])->middleware('throttle:registration')->name('demo');
});
Route::middleware('auth')->group(function () {
    Route::get('/', [PageController::class, 'home'])->name('home');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/catat', [TransactionController::class, 'create'])->name('transactions.create');
    Route::get('/riwayat', [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('/transaksi', [TransactionController::class, 'store'])->name('transactions.store');
    Route::get('/transaksi/{transaction}/ubah', [TransactionController::class, 'edit'])->name('transactions.edit');
    Route::put('/transaksi/{transaction}', [TransactionController::class, 'update'])->name('transactions.update');
    Route::delete('/transaksi/{transaction}', [TransactionController::class, 'destroy'])->name('transactions.destroy');
    Route::get('/kasbon', [DebtController::class, 'index'])->name('debts.index');
    Route::post('/kasbon', [DebtController::class, 'store'])->name('debts.store');
    Route::put('/kasbon/{debt}', [DebtController::class, 'update'])->name('debts.update');
    Route::post('/kasbon/{debt}/bayar', [DebtController::class, 'pay'])->name('debts.pay');
    Route::delete('/kasbon/{debt}', [DebtController::class, 'destroy'])->name('debts.destroy');
    Route::get('/stok', [StockController::class, 'index'])->name('stock.index');
    Route::post('/stok', [StockController::class, 'store'])->name('stock.store');
    Route::put('/stok/{product}', [StockController::class, 'update'])->name('stock.update');
    Route::post('/stok/{product}/sesuaikan', [StockController::class, 'adjust'])->name('stock.adjust');
    Route::post('/stok/{product}/masuk', [StockController::class, 'restock'])->name('stock.restock');
    Route::post('/stok/{product}/susut', [StockController::class, 'waste'])->name('stock.waste');
    Route::delete('/stok/{product}', [StockController::class, 'destroy'])->name('stock.destroy');
    Route::get('/laporan', [PageController::class, 'reports'])->name('reports');
    Route::get('/laporan/csv', [PageController::class, 'csv'])->name('reports.csv');
    Route::get('/pengaturan', [SettingsController::class, 'index'])->name('settings');
    Route::put('/pengaturan', [SettingsController::class, 'update'])->name('settings.update');
    Route::put('/pengaturan/pin', [SettingsController::class, 'pin'])->middleware('throttle:login')->name('settings.pin');
    Route::post('/pengaturan/impor', [SettingsController::class, 'import'])->name('settings.import');
    Route::get('/pengaturan/cadangan', [SettingsController::class, 'backup'])->name('settings.backup');
    Route::post('/pengaturan/reset', [SettingsController::class, 'reset'])->name('settings.reset');
    Route::delete('/pengaturan/data', [SettingsController::class, 'clear'])->name('settings.clear');
});
