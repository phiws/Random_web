<?php
// api.php
require_once 'db.php';

header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : '';

// Fungsi cek role mapala / admin
function checkMapalaOrAdmin() {
    if (!isset($_SESSION['user'])) {
        echo json_encode(["status" => "error", "message" => "Unauthorized: Silakan login terlebih dahulu."]);
        exit;
    }
    
    $role = $_SESSION['user']['role'] ?? '';
    if ($role !== 'admin' && $role !== 'mapala') {
        echo json_encode(["status" => "error", "message" => "Akses ditolak: Fitur khusus Anggota Mapala atau Admin."]);
        exit;
    }
}

switch ($action) {
    case 'get_peminjaman_aktif':
        checkMapalaOrAdmin();
        
        $response = supabaseRequest('peminjaman?status=eq.aktif&select=*', 'GET');
        
        if ($response['code'] >= 200 && $response['code'] < 300) {
            echo json_encode(["status" => "success", "data" => $response['data']]);
        } else {
            echo json_encode(["status" => "error", "message" => "Gagal mengambil data dari Supabase"]);
        }
        break;

    case 'tambah_alat':
        checkMapalaOrAdmin();
        
        // Data input dari form tambah alat
        $payload = [
            'nama_alat' => $_POST['nama_alat'] ?? '',
            'stok'      => $_POST['stok'] ?? 0,
            'kondisi'   => $_POST['kondisi'] ?? 'Baik',
            // Tanggal otomatis dibuat oleh Supabase (created_at dengan DEFAULT NOW())
        ];

        $response = supabaseRequest('alat', 'POST', $payload);

        if ($response['code'] >= 200 && $response['code'] < 300) {
            echo json_encode(["status" => "success", "message" => "Data alat berhasil ditambahkan"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Gagal menambahkan alat", "detail" => $response['data']]);
        }
        break;

    case 'pinjam_alat':
        // Form Pinjam Alat buat Kegiatan / Ekspedisi
        checkMapalaOrAdmin();

        $payload = [
            'id_user'        => $_SESSION['user']['id'],
            'nama_kegiatan'  => $_POST['nama_kegiatan'] ?? '',
            'id_alat'        => $_POST['id_alat'] ?? '',
            'jumlah_pinjam'  => $_POST['jumlah_pinjam'] ?? 1,
            'status'         => 'aktif',
            'tanggal_pinjam' => date('c') // Menyimpan tanggal & waktu pinjam format ISO 8601
        ];

        $response = supabaseRequest('peminjaman', 'POST', $payload);

        if ($response['code'] >= 200 && $response['code'] < 300) {
            echo json_encode(["status" => "success", "message" => "Peminjaman berhasil diajukan"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Gagal mengajukan peminjaman", "detail" => $response['data']]);
        }
        break;

    case 'tambah_perawatan':
        // Manajemen Perawatan & Perbaikan
        checkMapalaOrAdmin();

        $payload = [
            'id_alat'           => $_POST['id_alat'] ?? '',
            'keterangan_rusak'  => $_POST['keterangan_rusak'] ?? '',
            'status_perawatan'  => 'Proses',
            'updated_at'        => date('c') // Mencatat waktu update perawatan/perbaikan
        ];

        $response = supabaseRequest('perawatan', 'POST', $payload);

        if ($response['code'] >= 200 && $response['code'] < 300) {
            echo json_encode(["status" => "success", "message" => "Data perawatan berhasil dicatat"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Gagal mencatat perawatan", "detail" => $response['data']]);
        }
        break;

    case 'login':
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        
        $response = supabaseRequest('users?username=eq.' . urlencode($username), 'GET');
        
        if ($response['code'] >= 200 && $response['code'] < 300 && !empty($response['data'])) {
            $row = $response['data'][0];
            
            if ($password === $row['password']) {
                $_SESSION['user'] = [
                    'id'       => $row['id'],
                    'username' => $row['username'],
                    'role'     => $row['role']
                ];
                echo json_encode(["status" => "success", "message" => "Login berhasil", "role" => $row['role']]);
            } else {
                echo json_encode(["status" => "error", "message" => "Password salah"]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "User tidak ditemukan"]);
        }
        break;

    case 'check_session':
        if (isset($_SESSION['user'])) {
            echo json_encode(["status" => "success", "user" => $_SESSION['user']]);
        } else {
            echo json_encode(["status" => "error", "message" => "Belum login"]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Aksi tidak valid"]);
        break;
}
?>