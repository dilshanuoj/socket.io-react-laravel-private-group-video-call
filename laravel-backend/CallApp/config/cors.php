<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*', 'http://192.168.244.113:8000', 'https://086d-5-32-117-106.ngrok-free.app/'], // ✅ No '*'
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true, // ✅ Okay now, no wildcard origin
];
