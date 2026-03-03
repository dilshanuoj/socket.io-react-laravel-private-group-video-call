<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class UserController extends Controller
{
    public function index()
    {
        // Return all users except the currently logged-in one
        return response()->json(User::where('id', '!=', auth()->id())->select('id', 'name', 'email')->get());
    }
}
