# Expo Push Notification Integration Guide

Berikut adalah dokumentasi dan contoh kode yang Anda minta untuk diintegrasikan pada aplikasi Expo Anda. Seluruh file PHP backend dan skema _Database_ telah disiapkan di folder `backend-api-temins/api-app/notifications`.

## 1. Setup di Komponen Utama / Layout (app/\_layout.tsx)

Gunakan hooks `usePushNotifications` yang telah disiapkan di `hooks/usePushNotifications.ts` untuk selalu memonitor notifikasi masuk, sekalipun saat aplikasi sedang _foreground_.

```tsx
// app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePushNotifications } from "../hooks/usePushNotifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function RootLayout() {
  const { expoPushToken, notification, deviceId } = usePushNotifications();

  // (Opsional) Simpan ke async storage agar bisa diakses oleh halaman Login dengan mudah
  useEffect(() => {
    if (expoPushToken?.data && deviceId) {
      AsyncStorage.setItem("push_token", expoPushToken.data);
      AsyncStorage.setItem("device_id", deviceId);
    }
  }, [expoPushToken, deviceId]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

## 2. Contoh Flow Login & Pengiriman Token (app/index.tsx atau halaman login)

Kirim token push sesaat setelah proses _JWT token_ divalidasi dan login dinyatakan berhasil. Pastikan menggunakan `device.modelName` dari `expo-device` sebagai `device_name`.

```tsx
import React, { useState } from "react";
import { Button, TextInput, View, Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      // 1. Eksekusi API Login Backend
      const loginRes = await fetch(
        "https://be-data.dash.temins.id/api-app/auth/login.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );
      const loginData = await loginRes.json();

      if (loginData.status) {
        // Ambil token JWT dari response login
        const jwtToken = loginData.token;
        await AsyncStorage.setItem("user_token", jwtToken);

        // 2. Kirim Push Token
        await sendPushToken(jwtToken);

        // 3. Redirect
        router.push(loginData.data.redirect_target);
      } else {
        Alert.alert("Gagal", loginData.message);
      }
    } catch (err) {
      Alert.alert("Error", "Terjadi kesalahan sistem");
    }
  };

  const sendPushToken = async (jwtToken: string) => {
    try {
      const pushToken = await AsyncStorage.getItem("push_token");
      const deviceId = await AsyncStorage.getItem("device_id");
      const deviceName = Device.modelName || "Unknown Device";

      if (pushToken && deviceId) {
        // Panggil endpoint yang telah Anda buat di step sebelumnya
        await fetch(
          "https://be-data.dash.temins.id/api-app/notifications/save_push_token.php",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
              expo_push_token: pushToken,
              device_id: deviceId,
              device_name: deviceName,
            }),
          },
        );
        console.log("Push token berhasil dikirim ke backend.");
      }
    } catch (e) {
      console.log("Push token gagal dikirim", e);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
```

## 3. Testing via Postman

Untuk mengetesnya, ikuti langkah berikut:

### Tes 1: Menyimpan Token (Simulasi Frontend)

1. Buka Postman, buat request **POST** ke `https://be-data.dash.temins.id/api-app/notifications/save_push_token.php`.
2. Masukkan **Authorization: Bearer <JWT_ANDA>** di tab _Bearer Token_ (atau langsung di header).
3. Di tab _Body (raw JSON)_ masukkan:

```json
{
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxx]",
  "device_id": "test-device-id-123",
  "device_name": "Samsung Galaxy S23"
}
```

4. Verifikasi bahwa data berhasil masuk (`status: true`).

### Tes 2: Mengirim Notifikasi dari Backend ke Device

1. Buat request baru di Postman, **POST** ke `https://be-data.dash.temins.id/api-app/notifications/send_notification.php`.
2. Masukkan **Bearer Token** yang sama dengan yang sebelumnya.
3. Di tab _Body (raw JSON)_ masukkan:

```json
{
  "user_id": 1,
  "title": "Pesan Test Temins",
  "message": "Halo! Ini adalah notifikasi push testing dari Postman.",
  "data": { "target_screen": "AWS/index" }
}
```

4. Klik Send. Backend akan meneruskan request tersebut ke API Expo ke semua device milik `user_id` yang ditentukan.
