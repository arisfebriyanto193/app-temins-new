import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  Switch,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  Users,
  Settings,
  Bell,
  Mail,
  LogOut,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ChevronRight,
  User,
  Shield,
  Server,
  FlaskConical,
  Save,
} from 'lucide-react-native';
import { router } from 'expo-router';

const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api-app/admin/admin-set.php`;

// ===== TYPES =====
interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  diBuat: string;
}
interface AppConfig {
  status: number;
  versi: string;
  url: string;
}
interface PushUser {
  user_id: number;
  username: string;
  device_count: number;
}
interface EmailConfig {
  email: string;
  app_pass: string;
}

type TabKey = 'users' | 'config' | 'notif' | 'email';

// ===== HELPERS =====
function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ===== MAIN COMPONENT =====
export default function AdminInfoScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Notif toast
  const [toast, setToast] = useState<{ visible: boolean; ok: boolean; msg: string }>({ visible: false, ok: true, msg: '' });
  const showToast = (ok: boolean, msg: string) => {
    setToast({ visible: true, ok, msg });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const getToken = async () => {
    return await AsyncStorage.getItem('user_token');
  };

  // ---- ADMIN USERS ----
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchAdminUsers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${BASE_URL}?action=admin-users`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (res.data?.status && res.data?.data) setAdminUsers(res.data.data);
    } catch { /* silent */ } finally {
      setLoadingUsers(false);
    }
  }, []);

  const handleAddAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password) {
      showToast(false, 'Username & password wajib diisi');
      return;
    }
    const token = await getToken();
    if (!token) return;
    setAddingAdmin(true);
    try {
      const res = await axios.post(`${BASE_URL}?action=admin-users`, newAdmin, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.data?.status) {
        showToast(true, res.data.message || 'Admin berhasil ditambahkan');
        setNewAdmin({ username: '', password: '' });
        setShowAddAdminModal(false);
        fetchAdminUsers();
      } else {
        showToast(false, res.data.message || 'Gagal menambahkan admin');
      }
    } catch { showToast(false, 'Terjadi kesalahan'); } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = (admin: AdminUser) => {
    Alert.alert(
      'Hapus Admin',
      `Yakin ingin menghapus "${admin.username}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            try {
              const res = await axios.delete(`${BASE_URL}?action=admin-users&id=${admin.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.data?.status) {
                showToast(true, res.data.message || 'Admin dihapus');
                fetchAdminUsers();
              } else {
                showToast(false, res.data.message || 'Gagal menghapus');
              }
            } catch { showToast(false, 'Terjadi kesalahan'); }
          }
        }
      ]
    );
  };

  // ---- APP CONFIG ----
  const [configForm, setConfigForm] = useState<AppConfig>({ status: 1, versi: '', url: '' });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAppConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingConfig(true);
    try {
      const res = await axios.get(`${BASE_URL}?action=app-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.status && res.data?.data) setConfigForm(res.data.data);
    } catch { /* silent */ } finally {
      setLoadingConfig(false);
    }
  }, []);

  const handleSaveConfig = async () => {
    if (!configForm.versi || !configForm.url) {
      showToast(false, 'Versi dan URL wajib diisi');
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSavingConfig(true);
    try {
      const res = await axios.post(`${BASE_URL}?action=app-config`, configForm, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.data?.status) {
        showToast(true, res.data.message || 'Konfigurasi disimpan');
        if (res.data?.data) setConfigForm(res.data.data);
      } else {
        showToast(false, res.data.message || 'Gagal menyimpan');
      }
    } catch { showToast(false, 'Terjadi kesalahan'); } finally {
      setSavingConfig(false);
    }
  };

  // ---- PUSH NOTIF ----
  const [pushUsers, setPushUsers] = useState<PushUser[]>([]);
  const [loadingPushUsers, setLoadingPushUsers] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [notifForm, setNotifForm] = useState({ title: '', message: '' });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifResults, setNotifResults] = useState<{ user_id: number; ok: boolean; username?: string }[]>([]);

  const fetchPushUsers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingPushUsers(true);
    try {
      const res = await axios.get(`${BASE_URL}?action=push-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.status && res.data?.data) setPushUsers(res.data.data);
    } catch { /* silent */ } finally {
      setLoadingPushUsers(false);
    }
  }, []);

  const toggleUser = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSendNotif = async (sendAll: boolean) => {
    if (!notifForm.title || !notifForm.message) {
      showToast(false, 'Title dan pesan wajib diisi');
      return;
    }
    if (!sendAll && selectedIds.length === 0) {
      showToast(false, 'Pilih setidaknya satu user');
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSendingNotif(true);
    setNotifResults([]);
    try {
      const res = await axios.post(
        `${BASE_URL}?action=send-notif`,
        { title: notifForm.title, message: notifForm.message, user_ids: sendAll ? 'all' : selectedIds },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (res.data?.status) {
        showToast(true, res.data.message);
        const enriched = (res.data.results || []).map((r: any) => ({
          ...r,
          username: pushUsers.find(u => u.user_id === r.user_id)?.username,
        }));
        setNotifResults(enriched);
      } else {
        showToast(false, res.data.message || 'Gagal mengirim');
      }
    } catch { showToast(false, 'Terjadi kesalahan'); } finally {
      setSendingNotif(false);
    }
  };

  // ---- EMAIL CONFIG ----
  const [emailForm, setEmailForm] = useState<EmailConfig>({ email: '', app_pass: '' });
  const [showPass, setShowPass] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchEmailConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingEmail(true);
    try {
      const res = await axios.get(`${BASE_URL}?action=email-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.status && res.data?.data) {
        setEmailForm({ email: res.data.data.email, app_pass: res.data.data.app_pass });
      }
    } catch { /* silent */ } finally {
      setLoadingEmail(false);
    }
  }, []);

  const handleSaveEmail = async () => {
    if (!emailForm.email || !emailForm.app_pass) {
      showToast(false, 'Email dan app password wajib diisi');
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSavingEmail(true);
    try {
      const res = await axios.post(`${BASE_URL}?action=email-config`, { type: 'update', ...emailForm }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.data?.status) showToast(true, res.data.message);
      else showToast(false, res.data.message || 'Gagal menyimpan');
    } catch { showToast(false, 'Terjadi kesalahan'); } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo) { showToast(false, 'Email tujuan wajib diisi'); return; }
    const token = await getToken();
    if (!token) return;
    setTestingEmail(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${BASE_URL}?action=email-config`, { type: 'test', to: testEmailTo }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setTestResult({ ok: res.data?.status, msg: res.data?.message });
      if (res.data?.status) showToast(true, res.data.message);
      else showToast(false, res.data.message);
    } catch { setTestResult({ ok: false, msg: 'Kesalahan jaringan' }); } finally {
      setTestingEmail(false);
    }
  };

  // ---- LOGOUT ----
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys);
      setTimeout(() => router.replace('/'), 300);
    } catch {
      Alert.alert('Error', 'Gagal keluar');
      setLogoutLoading(false);
    }
  };

  // ---- LOAD DATA ON TAB CHANGE ----
  useEffect(() => {
    if (activeTab === 'users') fetchAdminUsers();
    else if (activeTab === 'config') fetchAppConfig();
    else if (activeTab === 'notif') fetchPushUsers();
    else if (activeTab === 'email') { fetchEmailConfig(); setTestResult(null); }
  }, [activeTab]);

  // ===================================================
  //  TAB RENDERERS
  // ===================================================

  const renderUsersTab = () => (
    <View>
      {/* Tambah Admin */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddAdminModal(true)}>
        <Plus size={18} color="#fff" />
        <Text style={styles.addBtnText}>Tambah Admin</Text>
      </TouchableOpacity>

      {loadingUsers ? (
        <View style={styles.centeredLoader}><ActivityIndicator color="#6366f1" size="large" /></View>
      ) : adminUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={40} color="#cbd5e1" />
          <Text style={styles.emptyText}>Belum ada admin</Text>
        </View>
      ) : (
        adminUsers.map(admin => (
          <View key={admin.id} style={styles.adminCard}>
            <View style={styles.adminAvatar}>
              <Text style={styles.adminAvatarText}>{admin.username?.[0]?.toUpperCase() || 'A'}</Text>
            </View>
            <View style={styles.adminInfo}>
              <Text style={styles.adminUsername}>{admin.username}</Text>
              <Text style={styles.adminEmail}>{admin.email || '-'}</Text>
              <Text style={styles.adminDate}>Dibuat: {formatDate(admin.diBuat)}</Text>
            </View>
            <View style={styles.adminBadgeCol}>
              <View style={[styles.roleBadge, admin.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
                <Text style={[styles.roleBadgeText, admin.role === 'admin' ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>
                  {admin.role}
                </Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteAdmin(admin)}>
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderConfigTab = () => (
    <View>
      {loadingConfig ? (
        <View style={styles.centeredLoader}><ActivityIndicator color="#6366f1" size="large" /></View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Settings size={18} color="#6366f1" />
            <Text style={styles.cardTitle}>Konfigurasi Aplikasi</Text>
          </View>

          {/* Status toggle */}
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Status Update</Text>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: configForm.status === 1 ? '#10b981' : '#94a3b8' }]}>
                {configForm.status === 1 ? 'Aktif' : 'Nonaktif'}
              </Text>
              <Switch
                value={configForm.status === 1}
                onValueChange={v => setConfigForm(prev => ({ ...prev, status: v ? 1 : 0 }))}
                trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Versi Aplikasi</Text>
            <TextInput
              style={styles.input}
              value={configForm.versi}
              onChangeText={v => setConfigForm(prev => ({ ...prev, versi: v }))}
              placeholder="Contoh: 1.2.0"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>URL Download APK</Text>
            <TextInput
              style={styles.input}
              value={configForm.url}
              onChangeText={v => setConfigForm(prev => ({ ...prev, url: v }))}
              placeholder="https://..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, savingConfig && styles.disabledBtn]}
            onPress={handleSaveConfig}
            disabled={savingConfig}
          >
            {savingConfig ? <ActivityIndicator color="#fff" size="small" /> : <Save size={16} color="#fff" />}
            <Text style={styles.primaryBtnText}>{savingConfig ? 'Menyimpan...' : 'Simpan Konfigurasi'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderNotifTab = () => (
    <View>
      {/* User list */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Users size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Pilih Penerima</Text>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={() => setSelectedIds(selectedIds.length === pushUsers.length ? [] : pushUsers.map(u => u.user_id))}
          >
            <Text style={styles.selectAllText}>
              {selectedIds.length === pushUsers.length ? 'Batal Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingPushUsers ? (
          <ActivityIndicator color="#6366f1" style={{ paddingVertical: 20 }} />
        ) : pushUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={32} color="#cbd5e1" />
            <Text style={styles.emptyText}>Tidak ada user dengan push token</Text>
          </View>
        ) : (
          pushUsers.map(u => (
            <TouchableOpacity
              key={u.user_id}
              style={[styles.userSelectRow, selectedIds.includes(u.user_id) && styles.userSelectRowActive]}
              onPress={() => toggleUser(u.user_id)}
            >
              <View style={[styles.checkbox, selectedIds.includes(u.user_id) && styles.checkboxActive]}>
                {selectedIds.includes(u.user_id) && <CheckCircle size={14} color="#fff" />}
              </View>
              <View style={styles.userSelectInfo}>
                <Text style={styles.userSelectName}>{u.username}</Text>
                <Text style={styles.userSelectSub}>{u.device_count} device</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Notif Form */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Bell size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Isi Notifikasi</Text>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={notifForm.title}
            onChangeText={v => setNotifForm(p => ({ ...p, title: v }))}
            placeholder="Judul notifikasi"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Pesan</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notifForm.message}
            onChangeText={v => setNotifForm(p => ({ ...p, message: v }))}
            placeholder="Isi pesan..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.notifBtns}>
          <TouchableOpacity
            style={[styles.outlineBtn, sendingNotif && styles.disabledBtn, { flex: 1 }]}
            onPress={() => handleSendNotif(false)}
            disabled={sendingNotif}
          >
            {sendingNotif ? <ActivityIndicator color="#6366f1" size="small" /> : <Send size={16} color="#6366f1" />}
            <Text style={styles.outlineBtnText}>
              {selectedIds.length > 0 ? `Kirim (${selectedIds.length})` : 'Kirim Dipilih'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, sendingNotif && styles.disabledBtn, { flex: 1 }]}
            onPress={() => handleSendNotif(true)}
            disabled={sendingNotif}
          >
            {sendingNotif ? <ActivityIndicator color="#fff" size="small" /> : <Send size={16} color="#fff" />}
            <Text style={styles.primaryBtnText}>Semua</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {notifResults.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hasil Pengiriman</Text>
          {notifResults.map((r, i) => (
            <View key={i} style={[styles.resultRow, r.ok ? styles.resultOk : styles.resultFail]}>
              {r.ok ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
              <Text style={[styles.resultText, r.ok ? styles.resultTextOk : styles.resultTextFail]}>
                {r.username || `User #${r.user_id}`}
              </Text>
              <Text style={[styles.resultBadge, r.ok ? styles.resultTextOk : styles.resultTextFail]}>
                {r.ok ? 'Terkirim' : 'Gagal'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderEmailTab = () => (
    <View>
      {/* Kredensial */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Mail size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Email Pengirim</Text>
        </View>

        {/* SMTP badge */}
        <View style={styles.smtpBadge}>
          <Server size={14} color="#6366f1" />
          <Text style={styles.smtpBadgeText}>SMTP: smtp.gmail.com:587 (dari .env)</Text>
        </View>

        {loadingEmail ? (
          <ActivityIndicator color="#6366f1" style={{ paddingVertical: 16 }} />
        ) : (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email Pengirim (Gmail)</Text>
              <TextInput
                style={styles.input}
                value={emailForm.email}
                onChangeText={v => setEmailForm(p => ({ ...p, email: v }))}
                placeholder="contoh@gmail.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>App Password Gmail</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={emailForm.app_pass}
                  onChangeText={v => setEmailForm(p => ({ ...p, app_pass: v }))}
                  placeholder="xxxx xxxx xxxx xxxx"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>Buat di Google Account → Security → App Passwords</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, savingEmail && styles.disabledBtn]}
              onPress={handleSaveEmail}
              disabled={savingEmail}
            >
              {savingEmail ? <ActivityIndicator color="#fff" size="small" /> : <Save size={16} color="#fff" />}
              <Text style={styles.primaryBtnText}>{savingEmail ? 'Menyimpan...' : 'Simpan Konfigurasi Email'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Test Kirim */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FlaskConical size={18} color="#10b981" />
          <Text style={styles.cardTitle}>Test Kirim Email</Text>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Email Tujuan</Text>
          <TextInput
            style={styles.input}
            value={testEmailTo}
            onChangeText={setTestEmailTo}
            placeholder="penerima@gmail.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.greenBtn, testingEmail && styles.disabledBtn]}
          onPress={handleTestEmail}
          disabled={testingEmail}
        >
          {testingEmail ? <ActivityIndicator color="#fff" size="small" /> : <Send size={16} color="#fff" />}
          <Text style={styles.primaryBtnText}>{testingEmail ? 'Mengirim...' : 'Kirim Test Email'}</Text>
        </TouchableOpacity>
        {testResult && (
          <View style={[styles.testResultBox, testResult.ok ? styles.testResultOk : styles.testResultFail]}>
            {testResult.ok ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
            <Text style={[styles.testResultText, testResult.ok ? { color: '#166534' } : { color: '#991b1b' }]}>
              {testResult.msg}
            </Text>
          </View>
        )}
      </View>

      {/* Info note */}
      
    </View>
  );

  // ===================================================
  //  MAIN RENDER
  // ===================================================
  const tabs: { key: TabKey; label: string; Icon: any }[] = [
    { key: 'users', label: 'Admin', Icon: Users },
    { key: 'config', label: 'App', Icon: Settings },
    { key: 'notif', label: 'Notif', Icon: Bell },
    { key: 'email', label: 'Email', Icon: Mail },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <View>
          <Text> </Text>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Panel pengelolaan sistem</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Toast */}
        {toast.visible && (
          <View style={[styles.toast, toast.ok ? styles.toastOk : styles.toastFail]}>
            {toast.ok ? <CheckCircle size={16} color="#fff" /> : <XCircle size={16} color="#fff" />}
            <Text style={styles.toastText}>{toast.msg}</Text>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <tab.Icon size={20} color={active ? '#6366f1' : '#94a3b8'} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'config' && renderConfigTab()}
          {activeTab === 'notif' && renderNotifTab()}
          {activeTab === 'email' && renderEmailTab()}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ===== MODALS ===== */}

        {/* Add Admin Modal */}
        <Modal visible={showAddAdminModal} transparent animationType="slide" onRequestClose={() => setShowAddAdminModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Tambah Admin Baru</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={newAdmin.username}
                  onChangeText={v => setNewAdmin(p => ({ ...p, username: v }))}
                  placeholder="Username"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={newAdmin.password}
                  onChangeText={v => setNewAdmin(p => ({ ...p, password: v }))}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowAddAdminModal(false)}>
                  <Text style={styles.outlineBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }, addingAdmin && styles.disabledBtn]}
                  onPress={handleAddAdmin}
                  disabled={addingAdmin}
                >
                  {addingAdmin ? <ActivityIndicator color="#fff" size="small" /> : <Plus size={16} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Tambah</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Logout Modal */}
        <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalIconWrap}>
                <AlertCircle size={48} color="#f59e0b" />
              </View>
              <Text style={styles.modalTitle}>Konfirmasi Keluar</Text>
              <Text style={styles.modalMsg}>
                Yakin ingin keluar dari akun? Semua data lokal akan dihapus.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowLogoutModal(false)} disabled={logoutLoading}>
                  <XCircle size={16} color="#64748b" />
                  <Text style={styles.outlineBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }, logoutLoading && styles.disabledBtn]} onPress={handleLogout} disabled={logoutLoading}>
                  {logoutLoading ? <ActivityIndicator color="#fff" size="small" /> : <LogOut size={16} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Ya, Keluar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ===================================================
//  STYLES
// ===================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center',
  },

  // Toast
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12,
  },
  toastOk: { backgroundColor: '#16a34a' },
  toastFail: { backgroundColor: '#dc2626' },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4,
  },
  tabItemActive: {
    borderBottomWidth: 2, borderBottomColor: '#6366f1',
  },
  tabLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  tabLabelActive: { color: '#6366f1', fontWeight: '700' },

  // Scroll
  scrollContent: { padding: 16 },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },

  // Admin user list
  adminCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  adminAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  adminAvatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  adminInfo: { flex: 1 },
  adminUsername: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  adminEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  adminDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  adminBadgeCol: { alignItems: 'flex-end', gap: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleBadgeAdmin: { backgroundColor: '#ede9fe' },
  roleBadgeUser: { backgroundColor: '#f1f5f9' },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  roleBadgeTextAdmin: { color: '#7c3aed' },
  roleBadgeTextUser: { color: '#475569' },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center',
  },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1', borderRadius: 12, padding: 14, marginBottom: 14,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Form elements
  formGroup: { marginBottom: 14 },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc',
  },
  textarea: { minHeight: 90 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 10,
  },
  hintText: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // Push notif
  userSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  userSelectRowActive: { backgroundColor: '#eef2ff', borderRadius: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  userSelectInfo: { flex: 1 },
  userSelectName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  userSelectSub: { fontSize: 12, color: '#64748b' },
  selectAllBtn: { marginLeft: 'auto' },
  selectAllText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  notifBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // Results
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 6,
  },
  resultOk: { backgroundColor: '#f0fdf4' },
  resultFail: { backgroundColor: '#fef2f2' },
  resultText: { flex: 1, fontSize: 14, fontWeight: '600' },
  resultTextOk: { color: '#166534' },
  resultTextFail: { color: '#991b1b' },
  resultBadge: { fontSize: 11, fontWeight: '700' },

  // Email
  smtpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10, marginBottom: 14,
  },
  smtpBadgeText: { fontSize: 12, color: '#475569' },
  testResultBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1,
  },
  testResultOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  testResultFail: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  testResultText: { flex: 1, fontSize: 13, fontWeight: '600' },
  warnBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#fef3c7',
    borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400e' },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1', borderRadius: 12, padding: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  greenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', borderRadius: 12, padding: 14,
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ef4444', borderRadius: 12, padding: 14,
  },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 12, padding: 14,
  },
  outlineBtnText: { color: '#6366f1', fontWeight: '700', fontSize: 15 },
  disabledBtn: { opacity: 0.6 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalIconWrap: { alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  modalMsg: { fontSize: 14, color: '#64748b', lineHeight: 22, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Empty / Loader
  centeredLoader: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: '#94a3b8' },

  // Avatar section (profile)
  avatarSection: { alignItems: 'center' },
});
