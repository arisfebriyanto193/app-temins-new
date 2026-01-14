import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  Linking,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { 
  User, 
  Cpu, 
  MapPin, 
  Globe, 
  ShieldCheck, 
  Phone, 
  Hash, 
  Clock, 
  Info,
  ChevronRight,
  Smartphone,
  Calendar,
  LogOut,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Package,
  RefreshCw
} from 'lucide-react-native';

import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function AccountInfoScreen() {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [currentVersion] = useState(process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0");
  const [fetchError, setFetchError] = useState(false);
  
  // Ganti dengan endpoint API Anda
  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api-app/user/info.php`;
  const VERSION_CHECK_URL = `${process.env.EXPO_PUBLIC_API_URL}/api-app/admin/app.json`;

  useEffect(() => {
    fetchAccountData();
  }, []);

  const fetchAccountData = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const token = await AsyncStorage.getItem('user_token');

      if (!token) {
        Alert.alert("Error", "Token tidak ditemukan");
        router.replace('/');
        return;
      }

      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 10000, // Timeout 10 detik
      });

      console.log(API_URL);

      // 🔥 PAKAI DATA ASLI DARI API
      if (res.data?.status) {
        setAccountData(res.data);
      } else {
        // Data tidak valid, tapi kita tetap lanjut tanpa error
        console.log("Data akun tidak lengkap");
        setAccountData(null);
      }

    } catch (err: any) {
      console.error("API ERROR:", err.response?.data || err.message);
      setFetchError(true);
      // Tidak menampilkan alert agar user tetap bisa logout
    } finally {
      setLoading(false);
    }
  };

  const checkAppVersion = async () => {
    setCheckingUpdate(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      
      if (!token) {
        Alert.alert("Error", "Token tidak ditemukan");
        return;
      }
      
      const res = await axios.get(VERSION_CHECK_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      if (res.data?.status) {
        const apiVersion = res.data.versi;
        const currentV = currentVersion;
        
        // Periksa apakah versi API lebih baru
        if (isNewerVersion(apiVersion, currentV)) {
          setUpdateData(res.data);
          setShowUpdateModal(true);
        } else {
          Alert.alert(
            "Versi Terbaru", 
            `Aplikasi sudah dalam versi terbaru (${currentV})`,
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert("Info", "Tidak dapat memeriksa versi aplikasi");
      }
      
    } catch (err: any) {
      console.error("VERSION CHECK ERROR:", err.response?.data || err.message);
      Alert.alert("Error", "Gagal memeriksa versi aplikasi");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const isNewerVersion = (newVersion: string, currentVersion: string) => {
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false; // Versi sama
  };

  const handleUpdateNow = () => {
    if (updateData?.url) {
      Linking.openURL(updateData.url)
        .then(() => {
          setShowUpdateModal(false);
        })
        .catch((err) => {
          Alert.alert("Error", "Gagal membuka URL download");
          console.error("Failed to open URL:", err);
        });
    } else {
      Alert.alert("Error", "URL download tidak tersedia");
    }
  };

  const handleUpdateLater = () => {
    setShowUpdateModal(false);
  };

  // FUNGSI LOGOUT YANG TIDAK TERGANTUNG PADA FETCH API
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      // Hapus semua data cache
      await AsyncStorage.multiRemove([
        'user_token',
        'user_data',
        // Cache untuk dashboard
        '@aws_dashboard_config',
        '@aws_history_config',
        '@aws_sensor_values',
        '@aws_chart_data',
        '@aws_rain_data',
        '@aws_last_fetch',
        '@aws_mqtt_state',
        // Cache untuk smart farm
        '@smartfarm_config_data',
        '@smartfarm_sensor_values',
        '@smartfarm_chart_data',
        '@smartfarm_last_fetch',
        '@smartfarm_offline_data',
      ]);

      // Hapus semua chart cache
      const allKeys = await AsyncStorage.getAllKeys();
      const chartCacheKeys = allKeys.filter(key => 
        key.startsWith('@aws_chart_data') || 
        key.startsWith('@smartfarm_chart_data')
      );
      
      if (chartCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(chartCacheKeys);
      }

      setShowLogoutModal(false);
      
      // Tunggu sebentar sebelum redirect untuk memberikan feedback visual
      setTimeout(() => {
        router.replace('/');
      }, 500);

    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert("Error", "Gagal keluar. Silakan coba lagi.");
      setLogoutLoading(false);
    }
  };

  const handleLogoutConfirmation = () => {
    setShowLogoutModal(true);
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  const handleRetryFetch = () => {
    fetchAccountData();
  };

  // Gunakan data dummy jika fetch gagal
  const user = accountData?.data?.[0] || {
    device_name: 'Tidak tersedia',
    device_unique_id: 'Tidak tersedia',
    device_type: 'Tidak tersedia',
    city: 'Tidak tersedia',
    location: 'Tidak tersedia',
    timezone: 'Tidak tersedia',
    owner_name: 'Tidak tersedia',
    pic_contact: 'Tidak tersedia',
    internet_no: 'Tidak tersedia',
    status: '0'
  };

  const InfoRow = ({ icon: Icon, label, value, color = "#64748b" }) => (
    <View style={styles.infoRow}>
      <View style={[styles.iconContainer, { backgroundColor: color + '10' }]}>
        <Icon size={18} color={color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || '-'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Info Akun</Text>
            <Text style={styles.headerSubtitle}>Detail profil dan perangkat Anda</Text>
          </View>
          {/* Tombol logout tetap tersedia saat loading */}
          <TouchableOpacity 
            style={styles.logoutHeaderButton}
            onPress={handleLogoutConfirmation}
          >
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Memuat data akun...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header dengan tombol logout */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Info Akun</Text>
          <Text style={styles.headerSubtitle}>Detail profil dan perangkat Anda</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutHeaderButton}
          onPress={handleLogoutConfirmation}
        >
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Pesan error jika fetch gagal */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <AlertCircle size={20} color="#f59e0b" />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorTitle}>Gagal memuat data akun</Text>
            <Text style={styles.errorMessage}>Koneksi internet mungkin terganggu</Text>
          </View>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={handleRetryFetch}
          >
            <RefreshCw size={16} color="#6366f1" />
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card Utama */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>ID</Text>
            </View>
            <Text style={styles.userIdText}>
              User ID: {accountData?.user_id || 'Tidak tersedia'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: user.status === "1" ? '#dcfce7' : '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: user.status === "1" ? '#166534' : '#991b1b' }]}>
                {user.status === "1" ? 'AKUN AKTIF' : 'NONAKTIF'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Informasi Perangkat */}
        <View style={styles.sectionHeader}>
          <Cpu size={18} color="#475569" />
          <Text style={styles.sectionTitle}>Informasi Perangkat</Text>
        </View>

        <View style={styles.card}>
          <InfoRow icon={Smartphone} label="Nama Perangkat" value={user.device_name} color="#6366f1" />
          <View style={styles.line} />
          <InfoRow icon={Hash} label="Device Unique ID" value={user.device_unique_id} color="#0ea5e9" />
          <View style={styles.line} />
          <InfoRow icon={ShieldCheck} label="Tipe Perangkat" value={user.device_type} color="#10b981" />
        </View>

        {/* Section: Lokasi & Waktu */}
        <View style={styles.sectionHeader}>
          <MapPin size={18} color="#475569" />
          <Text style={styles.sectionTitle}>Lokasi & Waktu</Text>
        </View>

        <View style={styles.card}>
          <InfoRow icon={Globe} label="Wilayah / Kota" value={user.city} color="#f59e0b" />
          <View style={styles.line} />
          <InfoRow icon={MapPin} label="Detail Lokasi" value={user.location} color="#ef4444" />
          <View style={styles.line} />
          <InfoRow icon={Clock} label="Zona Waktu" value={user.timezone} color="#8b5cf6" />
        </View>

        {/* Section: Kontak & Teknis */}
        <View style={styles.sectionHeader}>
          <Phone size={18} color="#475569" />
          <Text style={styles.sectionTitle}>Kontak & Teknis</Text>
        </View>

        <View style={styles.card}>
          <InfoRow icon={User} label="Nama Pemilik" value={user.owner_name} color="#6366f1" />
          <View style={styles.line} />
          <InfoRow icon={Phone} label="PIC Contact" value={user.pic_contact} color="#10b981" />
          <View style={styles.line} />
          <InfoRow icon={Info} label="Internet No" value={user.internet_no} color="#64748b" />
        </View>

        {/* Section: Versi Aplikasi */}
        <View style={styles.sectionHeader}>
          <Package size={18} color="#475569" />
          <Text style={styles.sectionTitle}>Versi Aplikasi</Text>
        </View>

        <TouchableOpacity 
          style={styles.versionCard}
          onPress={checkAppVersion}
          disabled={checkingUpdate}
        >
          <View style={styles.versionInfo}>
            <View style={styles.versionHeader}>
              <Package size={20} color="#6366f1" />
              <Text style={styles.versionTitle}>Versi Saat Ini</Text>
            </View>
            <Text style={styles.versionNumber}>{currentVersion}</Text>
          </View>
          
          <View style={styles.checkUpdateButton}>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <>
                <RefreshCw size={16} color="#6366f1" />
                <Text style={styles.checkUpdateText}>Cek Update</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Logout Button Section */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogoutConfirmation}
        >
          <View style={styles.logoutButtonContent}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.logoutButtonText}>Keluar Akun</Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelLogout}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <AlertCircle size={48} color="#f59e0b" />
            </View>
            
            <Text style={styles.modalTitle}>Konfirmasi Keluar</Text>
            
            <Text style={styles.modalMessage}>
              Apakah Anda yakin ingin keluar dari akun?
              {'\n\n'}
              Semua data lokal akan dihapus dan Anda perlu login kembali.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelLogout}
                disabled={logoutLoading}
              >
                <XCircle size={18} color="#64748b" />
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
                disabled={logoutLoading}
              >
                {logoutLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <LogOut size={18} color="#ffffff" />
                    <Text style={styles.confirmButtonText}>Ya, Keluar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Update Available Modal */}
      <Modal
        visible={showUpdateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleUpdateLater}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.updateModalContent]}>
            <View style={[styles.modalIconContainer, styles.updateIconContainer]}>
              <Download size={48} color="#3b82f6" />
            </View>
            
            <Text style={styles.modalTitle}>Update Tersedia!</Text>
            
            <Text style={styles.modalMessage}>
              Versi baru <Text style={styles.highlightText}>{updateData?.versi}</Text> tersedia.
              {'\n\n'}
              Versi saat ini: <Text style={styles.currentVersionText}>{currentVersion}</Text>
              {'\n\n'}
              Silakan update untuk mendapatkan fitur terbaru dan perbaikan bug.
            </Text>

            {updateData?.url && (
              <View style={styles.downloadInfo}>
          
                <Text style={styles.downloadInfoText}>Format: APK</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.laterButton]}
                onPress={handleUpdateLater}
              >
                <XCircle size={18} color="#64748b" />
                <Text style={styles.laterButtonText}>Nanti Saja</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.updateNowButton]}
                onPress={handleUpdateNow}
              >
                <Download size={18} color="#ffffff" />
                <Text style={styles.updateNowButtonText}>Update Sekarang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  logoutHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  // Error Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  errorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 12,
    color: '#b45309',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 6,
  },
  scrollContent: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  userIdText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  versionCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  versionInfo: {
    flex: 1,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 8,
  },
  versionNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  checkUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  checkUpdateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  line: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
    marginLeft: 56,
  },
  logoutButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  updateModalContent: {
    maxWidth: 450,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  updateIconContainer: {
    backgroundColor: '#dbeafe',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  highlightText: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  currentVersionText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  downloadInfo: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
  },
  downloadInfoText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  laterButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  updateNowButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  updateNowButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});