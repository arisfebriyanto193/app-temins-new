# Dokumentasi Aplikasi Android Temins IoT (React Native / Expo)

Dokumentasi ini menyajikan panduan arsitektur, struktur file, konfigurasi lingkungan, alur autentikasi, integrasi push notification Firebase, modul navigasi Expo Router, integrasi telemetri MQTT, serta panduan build APK untuk aplikasi mobile **Temins IoT** yang berlokasi di:
`/home/aris/Dokumen/projeck/Temins/app-temins-new`

---

## Daftar Isi
1. [Gambaran Umum Aplikasi](#1-gambaran-umum-aplikasi)
2. [Teknologi & Dependensi Utama](#2-teknologi--dependensi-utama)
3. [Struktur Direktori & File Proyek](#3-struktur-direktori--file-proyek)
4. [Konfigurasi Lingkungan & Metadata Aplikasi](#4-konfigurasi-lingkungan--metadata-aplikasi)
   - [Variabel Lingkungan (.env)](#41-variabel-lingkungan-env)
   - [Konfigurasi Expo (app.json)](#42-konfigurasi-expo-appjson)
   - [Integrasi Firebase (google-services.json)](#43-integrasi-firebase-google-servicesjson)
   - [Profil Build (eas.json)](#44-profil-build-easjson)
5. [Arsitektur Autentikasi & Navigasi Dinamis](#5-arsitektur-autentikasi--navigasi-dinamis)
   - [Penyimpanan Sesi Lokal (AsyncStorage)](#51-penyimpanan-sesi-lokal-asyncstorage)
   - [Validasi Token JWT & Auto-Redirect](#52-validasi-token-jwt--auto-redirect)
   - [Peta Rute Berbasis Peran & Perangkat](#53-peta-rute-berbasis-peran--perangkat)
6. [Sistem Push Notification (Firebase Cloud Messaging)](#6-sistem-push-notification-firebase-cloud-messaging)
7. [Dokumentasi Lengkap Modul & Layar Aplikasi](#7-dokumentasi-lengkap-modul--layar-aplikasi)
   - [Layar Otentikasi (Login)](#71-layar-otentikasi-login)
   - [Modul AWS (Automatic Weather Station)](#72-modul-aws-automatic-weather-station)
   - [Modul AWLR (Automatic Water Level Recorder)](#73-modul-awlr-automatic-water-level-recorder)
   - [Modul Smart Farm (SF)](#74-modul-smart-farm-sf)
   - [Modul Instansi (B2B Multi-Perangkat)](#75-modul-instansi-b2b-multi-perangkat)
   - [Modul Admin Panel Mobile](#76-modul-admin-panel-mobile)
   - [Modul Utilitas Admin 2](#77-modul-utilitas-admin-2)
8. [Komponen & Antarmuka Khusus](#8-komponen--antarmuka-khusus)
9. [Integrasi Telemetri Realtime MQTT](#9-integrasi-telemetri-realtime-mqtt)
10. [Panduan Menjalankan & Build APK Android](#10-panduan-menjalankan--build-apk-android)
11. [Tips Pemeliharaan & Troubleshooting](#11-tips-pemeliharaan--troubleshooting)

---

## 1. Gambaran Umum Aplikasi

Aplikasi **Temins IoT Mobile** adalah aplikasi Android berbasis **React Native** dan **Expo SDK 54** yang dirancang sebagai antarmuka mobile komprehensif untuk ekosistem platform pemantauan Temins IoT. Aplikasi ini menyediakan pemantauan sensor secara realtime melalui protokol MQTT WebSocket, visualisasi grafik, penerimaan notifikasi bahaya (alert push notification) via Firebase Cloud Messaging, serta kontrol administratif langsung dari perangkat Android.

### Fitur Kunci:
- **Multi-Instrumen**: Mendukung stasiun cuaca (**AWS**), pemantau ketinggian muka air sungai (**AWLR**), pertanian cerdas (**Smart Farm**), dan agregasi korporasi (**Instansi**).
- **Streaming Telemetri Realtime**: Terhubung langsung ke broker MQTT via WSS dengan fallback nilai terakhir database.
- **Push Notification Otomatis**: Mendeteksi status waspada/siaga/peringatan dan menerima pesan darurat via Firebase FCM saat aplikasi sedang aktif, di background, maupun tertutup.
- **Visualisasi Grafis Interaktif**: Menampilkan kurva fluktuasi data dengan `react-native-chart-kit`, diagram mawar angin (*Wind Rose*) berbasis `react-native-svg`, serta animasi gelombang ketinggian air.
- **Admin Mobile Suite**: Fitur lengkap bagi administrator untuk mendaftarkan alat, mengedit sensor, menguji MQTT, menginspeksi log, dan mengatur otomasi alert.

---

## 2. Teknologi & Dependensi Utama

| Komponen | Paket / Versi | Kegunaan |
| :--- | :--- | :--- |
| **Framework Mobile** | React Native `0.81.5` / Expo `~54.0.31` | Framework pengembangan aplikasi Android & iOS native |
| **Navigasi & Routing** | `expo-router` `~6.0.21` | Navigasi berbasis struktur file (*file-based routing*) |
| **State & Penyimpanan** | `@react-native-async-storage/async-storage` `^2.2.0` | Penyimpanan token JWT, sesi akun, dan preferensi lokal |
| **Push Notification** | `expo-notifications` `^0.32.16` | Registrasi token FCM, listener notifikasi lokal/remote |
| **Protokol IoT** | `mqtt` `^5.14.1` & `buffer` `^6.0.3` | Klien MQTT WebSocket di lingkungan React Native |
| **Grafik & Visualisasi** | `react-native-chart-kit` `^6.12.0` | Grafik garis (LineChart) riwayat data sensor |
| **Grafik SVG Native** | `react-native-svg` `15.12.1` | Rendering diagram mawar angin, kompas, dan gelombang air |
| **Animasi & Transisi** | `react-native-reanimated` `~4.1.1` | Animasi 60 FPS untuk indikator visual dan modal |
| **Komponen UI** | `expo-blur`, `expo-linear-gradient` | Efek visual blur glassmorphism dan background gradien |
| **Ikonografi** | `lucide-react-native` & `@expo/vector-icons` | Ikon status sensor dan navigasi tab |
| **Pustaka Tanggal/Waktu**| `@react-native-community/datetimepicker` `8.4.4` | Modal pemilih tanggal untuk filter analitik |
| **Pustaka Dropdown** | `@react-native-picker/picker` `^2.11.4` | Selektor pilihan sensor, bulan, dan tahun |
| **File & Share** | `expo-file-system` & `expo-sharing` | Pengunduhan laporan dan pembagian dokumen data |
| **HTTP Client** | `axios` `^1.13.2` & Native Fetch | Komunikasi API RESTful ke backend Temins |

---

## 3. Struktur Direktori & File Proyek

```text
app-temins-new/
├── app/                               # Direktori Rute Navigasi Expo Router
│   ├── (tabs)/                        # Tab navigasi bawaan contoh
│   ├── admin/                         # Modul Admin Mobile Panel
│   │   ├── _layout.tsx                # Tab bar admin (Home, Dev, Instansi, Info)
│   │   ├── dev.tsx                    # Manajemen template perangkat
│   │   ├── index.tsx                  # Dashboard manajemen user, alat, CRUD, sensor
│   │   ├── info.tsx                   # Info akun admin & logout
│   │   └── instansi.tsx               # Manajemen instansi & penautan user
│   ├── admin2/                        # Modul Diagnostik Lanjutan Admin
│   │   ├── data.tsx                   # Inspektur log data sensor mentah
│   │   ├── mqtt.tsx                   # Konsol uji coba MQTT in-app
│   │   └── rec.tsx                    # Konfigurasi data recorder JSON
│   ├── AWLR/                          # Modul AWLR (Pemantau Muka Air)
│   │   ├── _layout.tsx                # Tab bar AWLR (Home, Riwayat, Power, Info)
│   │   ├── history.tsx                # Riwayat fluktuasi muka air
│   │   ├── index.tsx                  # Dasbor muka air, animasi gelombang & status siaga
│   │   ├── info.tsx                   # Informasi alat AWLR & profil
│   │   └── power.tsx                  # Telemetri daya & baterai AWLR
│   ├── AWS/                           # Modul AWS (Stasiun Cuaca Otomatis)
│   │   ├── _layout.tsx                # Tab bar AWS (Home, Wind Rose, Riwayat, Power, Akun)
│   │   ├── forecast.tsx               # Prakiraan cuaca cerdas lokal
│   │   ├── history.tsx                # Analisis riwayat data sensor & export
│   │   ├── index.tsx                  # Dasbor cuaca realtime, gauges, streaming grafik
│   │   ├── info.tsx                   # Info alat, cek update APK, profil, logout
│   │   ├── power.tsx                  # Telemetri solar panel & baterai AWS
│   │   └── wind-rose.tsx              # Diagram Mawar Angin SVG
│   ├── instansi/                      # Modul Instansi B2B (Multi-Device)
│   │   ├── _layout.tsx                # Tab bar Instansi
│   │   ├── forecast.tsx               # Prakiraan cuaca alat instansi
│   │   ├── history.tsx                # Riwayat data perangkat instansi
│   │   ├── index.tsx                  # Dasbor multi-alat dengan pemilih perangkat
│   │   ├── info.tsx                   # Profil instansi & akun
│   │   ├── power.tsx                  # Power monitoring perangkat instansi
│   │   └── wind-rose.tsx              # Mawar angin perangkat instansi
│   ├── sf/                            # Modul Smart Farm (Pertanian Cerdas)
│   │   ├── _layout.tsx                # Tab bar Smart Farm (Home, Riwayat, Info)
│   │   ├── history.tsx                # Riwayat hara tanah harian/mingguan
│   │   ├── index.tsx                  # Dasbor tanah, pH, NPK, EC/TDS/Salinitas
│   │   ├── info.tsx                   # Profil alat kebun & info akun
│   │   └── power.tsx                  # Telemetri daya alat Smart Farm
│   ├── null/null.tsx                  # Fallback screen jika perangkat belum terhubung
│   ├── utils/
│   │   └── auth.ts                    # Utilitas verifikasi token JWT lokal
│   ├── _layout.tsx                    # Root Layout (SafeAreaProvider & Slot)
│   ├── +html.tsx                      # Template wrapper HTML untuk mode web
│   └── index.tsx                      # Layar Login Utama & Registrasi Push Token
├── assets/                            # Berkas Grafis & Ikon
│   └── images/
│       ├── icon.png                   # Ikon aplikasi standar
│       ├── logo-app.png               # Logo utama aplikasi
│       ├── logo.png                   # Logo Temins
│       └── splash-icon.png            # Gambar Splash Screen pembuka
├── components/                        # Komponen Antarmuka Reusable
│   ├── admin/
│   │   └── EditDeviceModal.tsx        # Modal 4-Tab edit alat, akun, sensor, otomasi
│   ├── ui/                            # Komponen utilitas visual
│   ├── Themed.tsx                     # Komponen Text dan View adaptif tema
│   ├── external-link.tsx              # Tautan ke peramban eksternal
│   └── hello-wave.tsx                 # Animasi lambaian pembuka
├── constants/
│   ├── Colors.ts                      # Skema warna Dark / Light mode
│   └── theme.ts                       # Konfigurasi token tema aplikasi
├── hooks/
│   ├── usePushNotifications.ts        # Hook integrasi Firebase FCM & token registration
│   ├── use-color-scheme.ts            # Hook deteksi tema perangkat
│   └── use-theme-color.ts             # Hook penentuan warna elemen adaptif
├── app.json                           # Konfigurasi manifes Expo & Android build
├── eas.json                           # Konfigurasi profil build Expo Application Services
├── google-services.json               # Konfigurasi Firebase Cloud Messaging Android
├── package.json                       # Manifes dependensi dan skrip proyek
└── tsconfig.json                      # Konfigurasi TypeScript
```

---

## 4. Konfigurasi Lingkungan & Metadata Aplikasi

### 4.1. Variabel Lingkungan (.env)
File `.env` berisi konfigurasi endpoint backend:
```env
EXPO_PUBLIC_APP_VERSION=1.0.3
EXPO_PUBLIC_API_URL=https://be-dash.temins.id
EXPO_PUBLIC_API_DATA=https://be-data.dash.temins.id
EXPO_PUBLIC_API_TOKEN=RAHASIA_TOKEN_KAMU
```

- **`EXPO_PUBLIC_APP_VERSION`**: Versi aplikasi aktif (digunakan untuk pemeriksaan pembaharuan APK).
- **`EXPO_PUBLIC_API_URL`**: URL backend utama (`backend-node-temins`) untuk otentikasi login, data akun, konfigurasi sensor, dan admin panel.
- **`EXPO_PUBLIC_API_DATA`**: URL service data telemetri historis kecepatan tinggi.
- **`EXPO_PUBLIC_API_TOKEN`**: Token internal untuk mengizinkan request analitik historis.

### 4.2. Konfigurasi Expo (app.json)
- **Nama Aplikasi**: `temins-app`
- **Android Package**: `com.arisfebriyanto76.teminsapp`
- **Izin Android**: `["NOTIFICATIONS"]`
- **File Google Services**: `./google-services.json`
- **Skema Deep Link**: `teminsapp://`
- **Arsitektur Baru**: `"newArchEnabled": true`
- **Plugins**: `expo-router`, `expo-notifications`, `expo-splash-screen`
- **EAS Project ID**: `fe56ee36-40b7-4003-9fed-8550b23af242`

### 4.3. Integrasi Firebase (google-services.json)
File konfigurasi resmi dari Firebase Console yang menghubungkan aplikasi Android dengan project Google Cloud untuk penerimaan notifikasi FCM jarak jauh.

### 4.4. Profil Build (eas.json)
Mendukung 3 profil pembuatan paket aplikasi:
1. **`development`**: Untuk pengujian lokal menggunakan *Expo Development Client*.
2. **`preview`**: Menghasilkan berkas **APK mandiri (*standalone APK*)** untuk instalasi langsung tanpa melalui Play Store.
3. **`production`**: Menghasilkan berkas **AAB (*Android App Bundle*)** untuk publikasi ke Google Play Store dengan auto-increment versi.

---

## 5. Arsitektur Autentikasi & Navigasi Dinamis

### 5.1. Penyimpanan Sesi Lokal (AsyncStorage)
Setelah pengguna berhasil masuk, data disimpan pada penyimpanan persisten perangkat:
- **`user_token`**: String token JWT dari backend.
- **`user_data`**: JSON string profil pengguna (`user_id`, `username`, `role`, `device_type`, `redirect_target`).
- **`push_token`**: Token Expo Push Notification perangkat.

### 5.2. Validasi Token JWT & Auto-Redirect
Pada file [app/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/index.tsx):
1. Setiap kali aplikasi dibuka (*mount*), fungsi `checkExistingToken()` membaca `user_token`.
2. Fungsi `isTokenExpired(token)` ([app/utils/auth.ts](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/utils/auth.ts)) memeriksa apakah masa berlaku token telah habis.
3. Jika masih valid, pengguna langsung dialihkan ke dasbor instrumennya secara otomatis tanpa harus mengetik kredensial kembali.
4. Jika sudah kedaluwarsa, sesi dibersihkan dan form login ditampilkan.

### 5.3. Peta Rute Berbasis Peran & Perangkat
```text
Login Berhasil
   ├── role === 'instansi'  ──>  /instansi
   ├── role === 'admin'     ──>  /admin
   └── role === 'user'
         ├── device_type === 'AWS'         ──>  /AWS
         ├── device_type === 'AWLR'        ──>  /AWLR
         ├── device_type === 'Smart_Farm'  ──>  /sf
         └── default                       ──>  /AWS
```

---

## 6. Sistem Push Notification (Firebase Cloud Messaging)

Sistem notifikasi diimplementasikan melalui hook [hooks/usePushNotifications.ts](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/hooks/usePushNotifications.ts):

### Alur Kerja:
1. **Permintaan Izin**: Aplikasi meminta izin notifikasi (`Notifications.requestPermissionsAsync()`).
2. **Pengambilan Push Token**: Memanggil `Notifications.getExpoPushTokenAsync()` yang terhubung ke Firebase FCM melalui konfigurasi `google-services.json`.
3. **Identifikasi Perangkat**: Mengambil ID perangkat unik (`Application.getAndroidId()`).
4. **Pendaftaran ke Backend**:
   Pada [app/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/index.tsx), setelah login berhasil, token otomatis dikirim via POST ke:
   `${API_URL}/api-app/notifications/save_push_token.php`
   dengan payload:
   ```json
   {
     "expo_push_token": "ExponentPushToken[xxxxxxxx]",
     "device_id": "3a7b9c1d2e",
     "device_name": "Samsung Galaxy A52"
   }
   ```
5. **Foreground Notification Handler**: Menampilkan banner pop-up dan bunyi alert bahkan ketika aplikasi sedang dibuka di layar depan.

---

## 7. Dokumentasi Lengkap Modul & Layar Aplikasi

### 7.1. Layar Otentikasi (Login)
- **File**: [app/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/index.tsx)
- **Fitur**:
  - Animasi pembuka (Fade in & slide up) menggunakan Animated API.
  - Selektor tipe login: Akun Pengguna Biasa vs Akun Instansi.
  - Penanganan keyboard otomatis (`KeyboardAvoidingView` & auto-scale logo).
  - Tautan registrasi push token decoupled (mencegah *race condition* token vs login).

---

### 7.2. Modul AWS (Automatic Weather Station)

#### 1. Layout & Tab Bar ([app/AWS/_layout.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/_layout.tsx))
Mengelola 5 menu tab bawah:
- **Home** (`index.tsx`)
- **Wind Rose** (`wind-rose.tsx`)
- **Riwayat** (`history.tsx`)
- **Power** (`power.tsx`)
- **Akun** (`info.tsx`)

#### 2. Dasbor Utama Cuaca ([app/AWS/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/index.tsx))
- Mengambil inisialisasi konfigurasi dari `/api-app/user/aws/ds.php`.
- Menampilkan kartu telemetri realtime: Suhu Udara (°C), Kelembapan Udara (%), Radiasi Matahari (W/m² atau Lux), Kecepatan Angin (m/s), Arah Angin (°), dan Curah Hujan (mm).
- Klien MQTT WebSocket melakukan subscribe ke seluruh sensor aktif dan memperbarui angka serta grafik secara instan.
- Menampilkan grafik mini garis `LineChart` untuk tren parameter utama.

#### 3. Diagram Mawar Angin / Wind Rose ([app/AWS/wind-rose.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/wind-rose.tsx))
- Menggunakan `react-native-svg` untuk merender mawar angin lingkaran penuh berdiameter 280 px.
- Menghitung frekuensi sudut angin dalam 16 sektor kardinal (Utara, Timur Laut, Timur, dsb).
- Menampilkan 4 tingkatan kecepatan angin dengan warna: Biru (0–2 m/s), Hijau (2–5 m/s), Kuning (5–10 m/s), Merah (>10 m/s).

#### 4. Prakiraan Cuaca Cerdas ([app/AWS/forecast.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/forecast.tsx))
- Mengkalkulasikan tren barometer, radiasi surya, dan presipitasi untuk menampilkan proyeksi cuaca lokal (Cerah, Berawan, Hujan, Badai).

#### 5. Power Monitoring ([app/AWS/power.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/power.tsx))
- Menghubungi `/api-app/user/aws/power-mobile.php` dan mendengarkan MQTT untuk memantau tegangan aki/baterai, arus solar panel, dan konsumsi daya sistem.

#### 6. Riwayat Data ([app/AWS/history.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/history.tsx))
- Menampilkan grafik historis dengan filter rentang waktu (Harian, Bulanan, Tahunan).
- Dilengkapi fitur unduh data laporan sensor.

#### 7. Profil & Informasi Perangkat ([app/AWS/info.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWS/info.tsx))
- Menampilkan data kepemilikan alat, nomor SIM internet, lokasi GPS/alamat, masa aktif paket, dan kontak teknisi PIC.
- **Pemeriksaan Pembaruan Aplikasi**: Menghubungi `/api-app/app/versi.php` untuk mendeteksi ketersediaan versi APK terbaru dan menyediakan tombol unduh langsung.
- Tombol Keluar (Logout).

---

### 7.3. Modul AWLR (Automatic Water Level Recorder)

- **Layout**: [app/AWLR/_layout.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWLR/_layout.tsx)
- **Dasbor Muka Air** ([app/AWLR/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWLR/index.tsx)):
  - Menghubungi endpoint `/api-app/user/awlr/ds.php`.
  - Mengukur jarak sensor ke air dan mengkalkulasikan kedalaman air aktual.
  - **Visualisasi Animasi Air**: Menampilkan tabung/penampang sungai dengan gelombang air yang naik/turun sesuai data MQTT.
  - **Level Bahaya Banjir**: Mengubah warna status dan memicu alert visual:
    - Hijau: Normal
    - Kuning: Waspada
    - Oranye: Siaga
    - Merah: Awas (Bahaya Luapan)
  - Indikator kapasitas baterai instrumen.
- **Power & Riwayat**: [app/AWLR/power.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWLR/power.tsx) & [app/AWLR/history.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/AWLR/history.tsx).

---

### 7.4. Modul Smart Farm (SF)

- **Layout**: [app/sf/_layout.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/sf/_layout.tsx)
- **Dasbor Pertanian Presisi** ([app/sf/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/sf/index.tsx)):
  - Menghubungi `/api-app/user/sf/ds.php`.
  - Kartu parameter tanah: Kelembapan Tanah (%), Suhu Tanah (°C), Derajat Keasaman (pH).
  - Kartu hara NPK: Kadar Nitrogen (N), Fosfor (P), Kalium (K) dalam mg/kg tanah.
  - Kartu parameter larutan: Konduktivitas Elektrik (EC), Total Dissolved Solids (TDS), dan Salinitas.
  - Grafik tren dinamis dengan selektor sensor via Picker.
- **Power & Riwayat**: [app/sf/power.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/sf/power.tsx) & [app/sf/history.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/sf/history.tsx).

---

### 7.5. Modul Instansi (B2B Multi-Perangkat)

- **Layout**: [app/instansi/_layout.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/instansi/_layout.tsx)
- **Dasbor Agregasi** ([app/instansi/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/instansi/index.tsx)):
  - Menghubungi `/api-app/instansi/aws/ds.php`.
  - Menyediakan selektor dropdown perangkat untuk memilih stasiun cuaca milik anggota binaan instansi.
  - Setelah alat dipilih, telemetri realtime MQTT langsung dialihkan ke topik alat tersebut.

---

### 7.6. Modul Admin Panel Mobile

- **Layout**: [app/admin/_layout.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin/_layout.tsx)
- **Dasbor Manajemen Admin** ([app/admin/index.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin/index.tsx)):
  - Mengambil data seluruh pengguna dan perangkat dari `/api-app/admin/ds.php`.
  - Bilah pencarian cepat berdasarkan nama alat, pemilik, atau ID.
  - Filter status perangkat: Semua, Aktif, Nonaktif, Online, Offline (dihitung dari toleransi selisih waktu log data terakhir).
  - Modal pembuatan akun dan registrasi alat baru.
  - Pengubahan kata sandi akun pengguna.
  - Penghapusan akun pengguna (dilindungi aturan demo).
- **Modal Komprehensif Sunting Perangkat** ([components/admin/EditDeviceModal.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/components/admin/EditDeviceModal.tsx)):
  - **Tab Alat**: Sunting nama alat, ID unik, lokasi, PIC kontak, nomor internet, zona waktu, masa aktif.
  - **Tab Akun**: Sunting username dan email pemilik.
  - **Tab Sensor**: Menambah/menghapus parameter sensor, topik MQTT, unit, visibilitas, dan urutan chart.
  - **Tab Otomasi**: Menambahkan aturan ambang batas (*threshold*), aksi kirim email, dan push notification otomatis.
- **Template Alat** ([app/admin/dev.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin/dev.tsx)): Pengelolaan katalog cetak biru sensor bawaan.
- **Manajemen Instansi** ([app/admin/instansi.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin/instansi.tsx)): Manajemen organisasi mitra dan penautan user.

---

### 7.7. Modul Utilitas Admin 2

- **Konsol MQTT In-App** ([app/admin2/mqtt.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin2/mqtt.tsx)):
  - Menguji koneksi broker MQTT langsung dari HP Android.
  - Mendukung konfigurasi host, port, protokol WSS/WS, username, password, publish topik & pesan, subscribe topik, serta log histori pesan masuk/keluar.
- **Data Sensor Mentah** ([app/admin2/data.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin2/data.tsx)):
  - Memeriksa baris data mentah dari engine `EXPO_PUBLIC_API_DATA`.
- **Data Recorder JSON** ([app/admin2/rec.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/app/admin2/rec.tsx)):
  - Memperbarui konfigurasi topik perekam data IoT.

---

## 8. Komponen & Antarmuka Khusus

- **[components/admin/EditDeviceModal.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/components/admin/EditDeviceModal.tsx)**: Komponen modal native terlengkap dengan 4 tab modular untuk mengelola parameter IoT.
- **[components/Themed.tsx](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/components/Themed.tsx)**: Komponen dasar `Text` dan `View` yang merespons perubahan mode gelap/terang sistem secara otomatis.
- **[constants/Colors.ts](file:///home/aris/Dokumen/projeck/Temins/app-temins-new/constants/Colors.ts)**: Penentu palet warna sistem:
  - Cyan Utama: `#06b6d4`
  - Biru Aksen: `#007AFF` / `#3b82f6`
  - Abu-abu Gelap / Slate: `#0f172a` / `#1e293b`

---

## 9. Integrasi Telemetri Realtime MQTT

Di lingkungan React Native, pustaka `mqtt` memerlukan polyfill buffer biner untuk membaca paket WebSocket:

```typescript
import { Buffer } from 'buffer';
import mqtt from 'mqtt';

// Polyfill Buffer global wajib untuk React Native
global.Buffer = Buffer;

// Inisialisasi Klien MQTT WebSocket Secure
const client = mqtt.connect('wss://karsacerdasinovatif.web.id:8081', {
  clientId: 'mobile_' + Math.random().toString(16).substring(2, 8),
  clean: true,
  reconnectPeriod: 4000,
});

client.on('connect', () => {
  // Subscribe ke topik sensor alat
  client.subscribe(`temins_iot/${deviceId}/#`);
});

client.on('message', (topic, message) => {
  const value = parseFloat(message.toString());
  // Perbarui state sensor
});
```

---

## 10. Panduan Menjalankan & Build APK Android

### 10.1. Prasyarat Sistem
- **Node.js**: Versi `18.x` atau `20.x` LTS
- **Expo CLI**: Terinstal secara lokal atau via `npx`
- **EAS CLI**: Terinstal secara global (`npm install -g eas-cli`)
- **Android Device / Emulator**: Dengan Android 10.0+ (API 29+)

### 10.2. Menjalankan di Mode Pengembangan (Local Dev)
1. Masuk ke direktori:
   ```bash
   cd /home/aris/Dokumen/projeck/Temins/app-temins-new
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Mulai server Expo:
   ```bash
   npx expo start
   ```
   Pindai kode QR menggunakan aplikasi **Expo Go** pada perangkat Android fisik atau tekan `a` untuk membuka Android Emulator.

### 10.3. Build APK Mandiri (Standalone APK via EAS Build)
Untuk menghasilkan berkas `.apk` yang dapat diinstal langsung di semua ponsel Android tanpa Expo Go:
1. Pastikan Anda telah login ke akun Expo:
   ```bash
   eas login
   ```
2. Jalankan build Android dengan profil `preview`:
   ```bash
   eas build -p android --profile preview
   ```
3. Tunggu hingga proses kompilasi cloud EAS selesai. Tautan unduhan file `.apk` akan diberikan pada terminal dan di dasbor expo.dev.

### 10.4. Build Bundle untuk Google Play Store (AAB)
Untuk memproduksi berkas `.aab` produksi:
```bash
eas build -p android --profile production
```

---

## 11. Tips Pemeliharaan & Troubleshooting

1. **Error `Buffer is not defined` pada MQTT**:
   - Jika koneksi MQTT gagal saat inisialisasi awal, pastikan baris `import { Buffer } from 'buffer'; global.Buffer = Buffer;` diletakkan di baris teratas sebelum pemanggilan `mqtt.connect()`.
2. **Izin Notifikasi Android 13+ (API 33+)**:
   - Android versi 13 ke atas mewajibkan izin *runtime* `POST_NOTIFICATIONS`. Hook `usePushNotifications.ts` sudah menangani dialog persetujuan ini secara otomatis saat aplikasi pertama kali dibuka.
3. **Pemberitahuan Kadaluwarsa Sesi**:
   - Token JWT memiliki masa berlaku (default 7 hari). Jika API merespons status `401 Unauthorized`, `AsyncStorage` dibersihkan dan pengguna diarahkan kembali ke layar login `app/index.tsx`.
4. **Optimalisasi Penggunaan Memori**:
   - Selalu putuskan koneksi klien MQTT (`client.end()`) pada fungsi cleanup `useEffect()` saat pengguna berpindah tab/layar untuk menghindari konsumsi daya baterai yang berlebihan.

---

*Dokumentasi ini disusun untuk mempermudah pemahaman arsitektur, pemeliharaan berkelanjutan, dan proses rilis aplikasi Android Temins IoT.*
