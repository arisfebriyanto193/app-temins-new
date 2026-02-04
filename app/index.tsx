import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTokenExpired } from './utils/auth';

// Placeholder logo - ganti dengan path logo Anda
const LOGO = require('../assets/images/logo.png');

//const LOGO = 'a';
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [formErrors, setFormErrors] = useState({ username: '', password: '' });

  // Animasi values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  // API URL
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Cek token saat pertama kali buka aplikasi
  useEffect(() => {
    checkExistingToken();

    // Start animations
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

  // Keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(logoScale, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const checkExistingToken = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      const userData = await AsyncStorage.getItem('user_data');

      if (!token || !userData) {
        setCheckingToken(false);
        return;
      }

      // 🔥 CEK EXP JWT
      if (isTokenExpired(token)) {
        await AsyncStorage.removeItem('user_token');
        await AsyncStorage.removeItem('user_data');
        setCheckingToken(false);
        return;
      }

      const parsedData = JSON.parse(userData);
      const deviceType = parsedData.device_type;

      setTimeout(() => {
        switch (deviceType) {
          case 'AWS':
            router.replace('/AWS');
            break;
          case 'AWLR':
            router.replace('/AWLR');
            break;
          case 'Smart_Farm':
            router.replace('/sf');
            break;
          case 'admin':
            router.replace('/admin');
            break;
          default:
            router.replace('/AWS');
        }
      }, 500);
    } catch (error) {
      console.error('Error checking token:', error);
      setCheckingToken(false);
    }
  };


  const validateForm = () => {
    let isValid = true;
    const errors = { username: '', password: '' };

    if (!username.trim()) {
      errors.username = 'Username harus diisi';
      isValid = false;
    }

    if (!password.trim()) {
      errors.password = 'Password harus diisi';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Clear previous errors
    setFormErrors({ username: '', password: '' });

    try {
      const apiUrl = `${API_URL}/api-app/auth/login.php`;

      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      console.log(json);
      if (json.status === true) {
        // Simpan token & user data
        await AsyncStorage.setItem('user_token', json.token);
        await AsyncStorage.setItem('user_data', JSON.stringify(json.data));

        // Animated success feedback
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Navigate based on device type
        const deviceType = json.data.device_type;
        const routes: { [key: string]: string } = {
          'AWS': '/AWS',
          'AWLR': '/AWLR',
          'Smart_Farm': '/sf',
          'admin': '/admin'
        };

        setTimeout(() => {
          router.replace(routes[deviceType] || '/AWS');
        }, 300);

      } else {
        Alert.alert(
          'Login Gagal',
          json.message || 'Username atau password salah',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Login error:', error);

      if (error.name === 'AbortError') {
        Alert.alert(
          'Timeout',
          'Koneksi timeout. Periksa jaringan Anda.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Koneksi Error',
          'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (formErrors.username) {
      setFormErrors({ ...formErrors, username: '' });
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (formErrors.password) {
      setFormErrors({ ...formErrors, password: '' });
    }
  };

  // Tampilkan loading saat cek token
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
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: insets.bottom + 20 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Animated.Image
            source={LOGO}
            style={[
              styles.logo,
              { transform: [{ scale: logoScale }] }
            ]}
            resizeMode="contain"
          />

        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <BlurView intensity={80} tint="light" style={styles.cardBlur}>
            <View style={styles.cardContent}>
              <View style={styles.titleContainer}>
                <Ionicons name="log-in-outline" size={28} color="#06b6d4" />
                <Text style={styles.title}>Masuk ke Akun</Text>
              </View>

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Ionicons name="person-outline" size={16} color="#64748b" />
                  <Text style={styles.label}>Username</Text>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    formErrors.username && styles.inputError
                  ]}
                  placeholder="Masukkan username Anda"
                  placeholderTextColor="#94a3b8"
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    // Focus next input
                  }}
                />
                {formErrors.username ? (
                  <Text style={styles.errorText}>{formErrors.username}</Text>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
                  <Text style={styles.label}>Password</Text>
                </View>
                <View style={[
                  styles.passwordWrapper,
                  formErrors.password && styles.inputError
                ]}>
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
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={isLoading ? "#94a3b8" : "#64748b"}
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
                  isLoading && styles.buttonDisabled,
                  !keyboardVisible && styles.buttonShadow
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
                      <Ionicons name="arrow-forward-outline" size={20} color="#ffffff" />
                      <Text style={styles.buttonText}>MASUK</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.footerLink}
                  onPress={() => Alert.alert(
                    'Lupa Password',
                    'Silakan hubungi administrator sistem untuk reset password.'
                  )}
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
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: width * 0.8,
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
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
});