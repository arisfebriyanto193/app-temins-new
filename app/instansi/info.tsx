import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const API_ADMIN = `${process.env.EXPO_PUBLIC_API_URL}/api-app/admin/instansi.php`;
const API_INSTANSI = `${process.env.EXPO_PUBLIC_API_URL}/api-app/instansi/aws/ds.php`;

interface Instansi {
  id: number;
  name: string;
  username: string;
  deskripsi?: string;
}

interface DeviceListItem {
  id: string;
  name: string;
  location: string;
  owner: string;
}

export default function InstansiAkun() {
  const [role, setRole] = useState<'admin' | 'instansi' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin states
  const [instansiList, setInstansiList] = useState<Instansi[]>([]);
  const [selectedInstansiId, setSelectedInstansiId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Instansi states
  const [deviceList, setDeviceList] = useState<DeviceListItem[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  // Common UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editData, setEditData] = useState<Instansi | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [switchLoading, setSwitchLoading] = useState<number | string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const userDataStr = await AsyncStorage.getItem('user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setRole(userData.role);
        if (userData.role === 'admin') {
          await loadInstansiList();
        } else {
          await loadDeviceList();
          const savedDev = await AsyncStorage.getItem('selected_device_id');
          setActiveDeviceId(savedDev);
        }
      }
    } catch (e) {
      console.error('Init error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getToken = async () => await AsyncStorage.getItem('user_token');

  // ADMIN LOGIC
  const loadInstansiList = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_ADMIN}?action=get_instansi`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInstansiList(Array.isArray(data) ? data : []);
    } catch (e) {
      setInstansiList([]);
    }
  };

  const loadDetail = async (id: number) => {
    setSelectedInstansiId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_ADMIN}?action=get_users_by_instansi&instansi_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      console.error('Load detail error:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const switchAccountForAdmin = async (inst: Instansi) => {
    setSwitchLoading(inst.id);
    try {
      const token = await getToken();
      const res = await fetch(`${API_ADMIN}?action=get_instansi_token&instansi_id=${inst.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status && data.token) {
        await AsyncStorage.multiSet([
          ['instansi_token', data.token],
          ['instansi_id', String(inst.id)],
          ['instansi_name', inst.name],
        ]);
        Alert.alert('Sukses', `Berhasil switch ke: ${inst.name}`, [
          { text: 'OK', onPress: () => router.replace('/instansi') }
        ]);
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal switch akun');
    } finally {
      setSwitchLoading(null);
    }
  };

  // INSTANSI LOGIC
  const loadDeviceList = async () => {
    try {
      const token = await AsyncStorage.getItem('instansi_token') || await getToken();
      const res = await fetch(API_INSTANSI, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setDeviceList(data.device_list || []);
      }
    } catch (e) {
      console.error('Load device error:', e);
    }
  };

  const selectDevice = async (dev: DeviceListItem) => {
    setSwitchLoading(dev.id);
    try {
      await AsyncStorage.multiSet([
        ['selected_device_id', dev.id],
        ['selected_device_name', dev.name],
      ]);
      setActiveDeviceId(dev.id);
      Alert.alert('Sukses', `Perangkat ${dev.name} aktif`, [
        { text: 'Buka Dashboard', onPress: () => router.replace('/instansi') }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Gagal memilih perangkat');
    } finally {
      setSwitchLoading(null);
    }
  };

  // DASHBOARD ACTIONS
  const handleLogout = async () => {
    Alert.alert('Logout', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/');
        }
      }
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (role === 'admin') await loadInstansiList();
    else await loadDeviceList();
    setRefreshing(false);
  };

  // RENDER HELPERS
  const filteredInstansi = instansiList.filter(i =>
    i.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredDevices = deviceList.filter(d =>
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={style.container}>
        <View style={style.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={style.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={style.header}>
        <View style={{ flex: 1 }}>
          <Text style={style.headerTitle}>{role === 'admin' ? 'Manajemen Instansi' : 'Info Akun'}</Text>
          <Text style={style.headerSub}>{role === 'admin' ? 'Kelola akun instansi' : 'Pilih perangkat untuk dimonitor'}</Text>
        </View>
        <TouchableOpacity style={style.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={style.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search */}
        <View style={style.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            style={style.searchInput}
            placeholder={role === 'admin' ? "Cari instansi..." : "Cari perangkat..."}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {role === 'admin' ? (
          /* ADMIN VIEW */
          <View>
            <TouchableOpacity style={style.addFullBtn} onPress={() => { setModalMode('add'); setShowModal(true); }}>
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Tambah Instansi</Text>
            </TouchableOpacity>
            {filteredInstansi.map(inst => (
              <View key={inst.id} style={style.card}>
                <TouchableOpacity style={style.cardMain} onPress={() => loadDetail(inst.id)}>
                  <View style={style.avatar}>
                    <Text style={style.avatarText}>{inst.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={style.cardName}>{inst.name}</Text>
                    <Text style={style.cardSub}>@{inst.username}</Text>
                  </View>
                  <TouchableOpacity style={style.primaryBtn} onPress={() => switchAccountForAdmin(inst)}>
                    {switchLoading === inst.id ? <ActivityIndicator size="small" color="white" /> : <Text style={style.btnText}>Pilih</Text>}
                  </TouchableOpacity>
                </TouchableOpacity>
                {selectedInstansiId === inst.id && detail && (
                  <View style={style.detailBox}>
                    <Text style={style.detailTitle}>Perangkat:</Text>
                    {detail.devices?.map((d: any, idx: number) => (
                      <View key={idx} style={style.deviceItem}><Text style={style.deviceText}>{d.device_name || d.device_unique_id}</Text></View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          /* INSTANSI VIEW */
          <View>
            {filteredDevices.map(dev => (
              <TouchableOpacity
                key={dev.id}
                style={[style.card, activeDeviceId === dev.id && style.cardActive]}
                onPress={() => selectDevice(dev)}
              >
                <View style={style.cardMain}>
                  <View style={[style.avatar, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="hardware-chip-outline" size={24} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={style.cardName}>{dev.name}</Text>
                    <Text style={style.cardSub}>{dev.location}</Text>
                    <Text style={style.cardMinor}>Owner: {dev.owner}</Text>
                  </View>
                  {activeDeviceId === dev.id ? (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  ) : (
                    <View style={style.outlineBtn}>
                      {switchLoading === dev.id ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={style.outlineBtnText}>pilih</Text>}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 16 },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  card: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, overflow: 'hidden' },
  cardActive: { borderColor: '#3b82f6', backgroundColor: '#f0f7ff', borderWidth: 2 },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardMinor: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  primaryBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  outlineBtn: { borderWidth: 1, borderColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  outlineBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12 },
  detailBox: { padding: 14, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailTitle: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  deviceItem: { paddingVertical: 4 },
  deviceText: { fontSize: 13, color: '#1e293b' },
  addFullBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 16 },
});
