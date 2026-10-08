<?php
// db.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Konfigurasi Supabase Anda
define('SUPABASE_URL', 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co'); 
define('SUPABASE_ANON_KEY', 'sb_publishable_uTVlToDWiAQEGYLwCAC1dg_9TNwyx8O');

// Fungsi helper untuk melakukan request ke Supabase REST API
function supabaseRequest($endpoint, $method = 'GET', $data = [], $headers = []) {
    $url = SUPABASE_URL . '/rest/v1/' . $endpoint;
    
    $defaultHeaders = [
        'apikey: ' . SUPABASE_ANON_KEY,
        'Authorization: Bearer ' . SUPABASE_ANON_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];
    
    $allHeaders = array_merge($defaultHeaders, $headers);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    if ($method === 'POST' || $method === 'PATCH' || $method === 'PUT') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $allHeaders);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}
?>