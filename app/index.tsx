import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isTokenExpired } from './utils/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────────────────────

const LOGO = require('../assets/images/logo.png');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LoginResult {
  jwt: string;
  userData: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Push notification state — isReady becomes true once token is resolved
  const { pushTokenString, isReady: pushReady, deviceId } = usePushNotifications();

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [formErrors, setFormErrors] = useState({ username: '', password: '' });
  const [loginType, setLoginType] = useState<'user' | 'instansi'>('user');

  /**
   * After a successful login we store the JWT + user data here.
   * A separate useEffect watches this + pushReady to send the push token
   * without any race condition.
   */
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);

  // Track whether we already sent the push token for this session
  const pushTokenSent = useRef(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // ───────────────────────────────────────────────────────────────────────
  // 1. On mount: check existing session + run entrance animations
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    checkExistingToken();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // 2. Keyboard listeners
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      Animated.timing(logoScale, { toValue: 0.8, duration: 300, useNativeDriver: true }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // 3. Push token sender — decoupled, no race condition
  //
  //    Fires when BOTH conditions are true:
  //      a) loginResult is set (login succeeded)
  //      b) pushReady is true (Expo token resolved, even if null)
  //
  //    This handles all four timing scenarios:
  //      • Token ready before login  → fires immediately after login
  //      • Token ready after login   → fires when token arrives
  //      • No token (denied/emulator) → fires immediately, sends nothing
  //      • Already sent this session → skipped via ref guard
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loginResult || !pushReady) return;
    if (pushTokenSent.current) return;

    const sendPushToken = async () => {
      if (!pushTokenString || !deviceId) {
        console.log('[PushToken] No token or deviceId available — skipping submission.');
        return;
      }

      pushTokenSent.current = true; // lock before async to prevent duplicates

      try {
        const url = `${API_URL}/api-app/notifications/save_push_token.php`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${loginResult.jwt}`,
          },
          body: JSON.stringify({
            expo_push_token: pushTokenString,
            device_id: deviceId,
            device_name: Device.deviceName ?? 'Unknown Device',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const result = await response.json();
        console.log('[PushToken] Saved. HTTP:', response.status, '| Response:', result);
      } catch (error: unknown) {
        // Non-fatal — login flow is unaffected
        if ((error as Error)?.name === 'AbortError') {
          console.warn('[PushToken] Save request timed out.');
        } else {
          console.warn('[PushToken] Failed to save push token:', error);
        }
        // Reset guard so it can retry on next app launch / re-render
        pushTokenSent.current = false;
      }
    };

    sendPushToken();
  }, [loginResult, pushReady]);

  // ───────────────────────────────────────────────────────────────────────
  // 4. Check existing JWT session
  // ───────────────────────────────────────────────────────────────────────

  const checkExistingToken = async () => {
    try {
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem('user_token'),
        AsyncStorage.getItem('user_data'),
      ]);

      if (!token || !userData) {
        setCheckingToken(false);
        return;
      }

      if (isTokenExpired(token)) {
        await Promise.all([
          AsyncStorage.removeItem('user_token'),
          AsyncStorage.removeItem('user_data'),
        ]);
        setCheckingToken(false);
        return;
      }

      const parsed = JSON.parse(userData);
      navigateAfterLogin(parsed.role, parsed.device_type);
    } catch (error) {
      console.error('[Login] Error checking existing token:', error);
      setCheckingToken(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────
  // 5. Navigation helper
  // ───────────────────────────────────────────────────────────────────────

  const navigateAfterLogin = useCallback(
    (role: string, deviceType: string) => {
      if (role === 'instansi') {
        router.replace('/instansi');
        return;
      }
      const routes: Record<string, string> = {
        AWS: '/AWS',
        AWLR: '/AWLR',
        Smart_Farm: '/sf',
        admin: '/admin',
      };
      router.replace((routes[deviceType] ?? '/AWS') as never);
    },
    [router]
  );

  // ───────────────────────────────────────────────────────────────────────
  // 6. Form validation
  // ───────────────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors = { username: '', password: '' };
    let valid = true;

    if (!username.trim()) {
      errors.username = 'Username harus diisi';
      valid = false;
    }
    if (!password.trim()) {
      errors.password = 'Password harus diisi';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  // ───────────────────────────────────────────────────────────────────────
  // 7. Login handler — ONLY handles auth, never touches push token
  // ───────────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setFormErrors({ username: '', password: '' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const baseUrl = `${API_URL}/api-app/auth/login.php`;
      const finalUrl = loginType === 'instansi' ? `${baseUrl}?login=instansi` : baseUrl;

      const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      if (json.status !== true) {
        Alert.alert('Login Gagal', json.message ?? 'Username atau password salah', [{ text: 'OK' }]);
        return;
      }

      // ── Persist session ──────────────────────────────────────────────
      await Promise.all([
        AsyncStorage.setItem('user_token', json.token),
        AsyncStorage.setItem('user_data', JSON.stringify(json.data)),
      ]);

      // Instansi also needs its own session keys
      if (loginType === 'instansi' || json.data?.role === 'instansi') {
        await Promise.all([
          AsyncStorage.setItem('instansi_token', json.token),
          AsyncStorage.setItem('instansi_id', String(json.data?.user_id ?? json.data?.id ?? '')),
          AsyncStorage.setItem('instansi_name', json.data?.name ?? json.data?.username ?? ''),
        ]);
      }

      // ── Signal push token sender (effect #3) ─────────────────────────
      setLoginResult({ jwt: json.token, userData: json.data });

      // ── Visual feedback + navigate ────────────────────────────────────
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Navigate immediately — push token sending is non-blocking
      setTimeout(() => {
        navigateAfterLogin(json.data?.role, json.data?.device_type);
      }, 300);

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if ((error as Error)?.name === 'AbortError') {
        Alert.alert('Timeout', 'Koneksi timeout. Periksa jaringan Anda.', [{ text: 'OK' }]);
      } else {
        Alert.alert('Koneksi Error', 'Tidak dapat terhubung ke server.', [{ text: 'OK' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────
  // 8. Input change handlers
  // ───────────────────────────────────────────────────────────────────────

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (formErrors.username) setFormErrors((prev) => ({ ...prev, username: '' }));
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: '' }));
  };

  // ───────────────────────────────────────────────────────────────────────
  // 9. Render – Loading screen while checking existing session
  // ───────────────────────────────────────────────────────────────────────

  if (checkingToken) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContent}>
          <Animated.View style={[styles.loadingLogo, { transform: [{ scale: logoScale }] }]}>
            <Ionicons name="shield-checkmark" size={80} color="#06b6d4" />
          </Animated.View>
          <Text style={styles.loadingText}>Memeriksa sesi...</Text>
        </View>
      </View>
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // 10. Render – Login form
  // ───────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={Platform.OS === 'android'}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Animated.View
          style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Animated.Image
            source={LOGO}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <BlurView intensity={80} tint="light" style={styles.cardBlur}>
            <View style={styles.cardContent}>

              {/* Login Type Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleBtn, loginType === 'user' && styles.toggleBtnActive]}
                  onPress={() => setLoginType('user')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={loginType === 'user' ? 'person' : 'person-outline'}
                    size={16}
                    color={loginType === 'user' ? 'white' : '#64748b'}
                  />
                  <Text style={[styles.toggleText, loginType === 'user' && styles.toggleTextActive]}>
                    User Biasa
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, loginType === 'instansi' && styles.toggleBtnInstansi]}
                  onPress={() => setLoginType('instansi')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={loginType === 'instansi' ? 'business' : 'business-outline'}
                    size={16}
                    color={loginType === 'instansi' ? 'white' : '#64748b'}
                  />
                  <Text style={[styles.toggleText, loginType === 'instansi' && styles.toggleTextActive]}>
                    Instansi
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Ionicons
                  name={loginType === 'instansi' ? 'business-outline' : 'log-in-outline'}
                  size={28}
                  color={loginType === 'instansi' ? '#3b82f6' : '#06b6d4'}
                />
                <Text style={styles.title}>
                  {loginType === 'instansi' ? 'Login Instansi' : 'Masuk ke Akun'}
                </Text>
              </View>

              {/* Username */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Ionicons name="person-outline" size={16} color="#64748b" />
                  <Text style={styles.label}>
                    {loginType === 'instansi' ? 'Username Instansi' : 'Username'}
                  </Text>
                </View>
                <TextInput
                  style={[styles.input, formErrors.username && styles.inputError]}
                  placeholder="Masukkan username Anda"
                  placeholderTextColor="#94a3b8"
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                />
                {formErrors.username ? (
                  <Text style={styles.errorText}>{formErrors.username}</Text>
                ) : null}
              </View>

              {/* Password */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
                  <Text style={styles.label}>Password</Text>
                </View>
                <View style={[styles.passwordWrapper, formErrors.password && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Masukkan password Anda"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={isLoading ? '#94a3b8' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>
                {formErrors.password ? (
                  <Text style={styles.errorText}>{formErrors.password}</Text>
                ) : null}
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  loginType === 'instansi' && styles.buttonInstansi,
                  isLoading && styles.buttonDisabled,
                  !keyboardVisible && styles.buttonShadow,
                ]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={loginType === 'instansi' ? 'business-outline' : 'arrow-forward-outline'}
                        size={20}
                        color="#ffffff"
                      />
                      <Text style={styles.buttonText}>
                        {loginType === 'instansi' ? 'MASUK INSTANSI' : 'MASUK'}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.footerLink}
                  onPress={() =>
                    Alert.alert(
                      'Lupa Password',
                      'Silakan hubungi administrator sistem untuk reset password.'
                    )
                  }
                >
                  <Ionicons name="help-circle-outline" size={16} color="#64748b" />
                  <Text style={styles.footerLinkText}>Lupa password?</Text>
                </TouchableOpacity>
              </View>

            </View>
          </BlurView>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: height,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  logo: {
    width: width * 0.35,
    height: width * 0.35,
    marginBottom: 16,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 28,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6,
  },
  input: {
    height: 56,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    fontSize: 16,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingRight: 10,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#06b6d4',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  buttonShadow: {
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  buttonInstansi: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleBtnInstansi: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: 'white',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 6,
  },
});