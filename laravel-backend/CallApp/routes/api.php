<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});


Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    // Route::get('/users', function () {
    //     return User::select('id', 'name')->get();
    // });
});
Route::middleware('auth:sanctum')->get('/me', function (Request $request) {
    $user = $request->user(); // This will be a real User model
    return response()->json($user);
});

use App\Http\Controllers\Api\UserController;

Route::middleware('auth:sanctum')->get('/users', [UserController::class, 'index']);
