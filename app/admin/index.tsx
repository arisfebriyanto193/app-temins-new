import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import {
  Battery,
  ChevronDown,
  Cloud,
  Cpu,
  Droplets,
  Eye,
  EyeOff,
  Filter,
  Key,
  MapPin,
  Network,
  Plus,
  Power,
  RotateCw,
  Ruler,
  Save,
  Search,
  Settings,
  Sun,
  Thermometer,
  Trash2,
  Waves,
  Wifi,
  WifiOff,
  Wind,
  X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;


interface SensorParam {
  id?: string;
  label: string;
  topic: string;
  unit: string;
  is_visible: boolean;
  is_chart: boolean;
  chart_order: number;
  chart_data: string;
}

export default function AdminDashboard() {
  // --- States ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [templates, setTemplates] = useState({});
  const [deviceStatus, setDeviceStatus] = useState({ aktif: 0, nonaktif: 0, online: 0, offline: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'online', 'offline', 'active', 'inactive'
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Modals & Forms
  const [modalMode, setModalMode] = useState('none'); // 'none' | 'add' | 'edit' | 'password' | 'details'
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [paramsList, setParamsList] = useState<SensorParam[]>([]);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'location', 'advanced', 'sensors'

  // Animation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // API Config
  const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
  const DATA_URL = `${process.env.EXPO_PUBLIC_API_DATA}`;
  const API_TOKEN = `${process.env.EXPO_PUBLIC_API_TOKEN}`;

  // --- Animations ---
  const startSpinAnimation = () => {
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const rotateInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    fetchData();
    fetchTemplates();
  }, []);

  // --- Helper Functions ---
  const isDeviceOnline = (recordedAt) => {
    if (!recordedAt) return false;
    const last = new Date(recordedAt).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - last) / (1000 * 60));
    return diffMinutes <= 30;
  };

  const getDeviceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'awlr': return Waves;
      case 'aws': return Cloud;
      case 'weather': return Thermometer;
      case 'water': return Droplets;
      case 'air': return Wind;
      case 'solar': return Sun;
      case 'battery': return Battery;
      case 'network': return Network;
      default: return Cpu;
    }
  };

  const getStatusColor = (status, isOnline) => {
    if (status === "0") return '#ef4444'; // Inactive - red
    if (!isOnline) return '#f97316'; // Offline - orange
    return '#22c55e'; // Online - green
  };

  const getStatusText = (status, isOnline) => {
    if (status === "0") return "NONAKTIF";
    if (!isOnline) return "OFFLINE";
    return "ONLINE";
  };

  // --- Data Functions ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.get(`${BASE_URL}/api-app/admin/ds.php`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status) {
        setUsers(res.data.data);
        setFilteredUsers(res.data.data);
        setDeviceStatus(prev => ({ ...prev, ...res.data.device_status }));
        await checkOnlineStatus(res.data.data);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Gagal mengambil data perangkat");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.get(`${BASE_URL}/api-app/admin/ds.php?action=get_templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.status) setTemplates(res.data.data);
    } catch (e) { console.error(e); }
  };

  const checkOnlineStatus = async (userList) => {
    setCheckingStatus(true);
    startSpinAnimation();

    try {
      // Ambil user yang status alatnya aktif
      const activeUsers = userList.filter(u => u.status === "1");
      if (activeUsers.length === 0) {
        //   console.log('⚠️ Tidak ada perangkat aktif');
        return;
      }

      // Gabungkan device ID untuk request API
      const deviceIds = activeUsers
        .map(u => u.device_unique_id)
        .join(",");

      const res = await axios.get(
        `${DATA_URL}/api/get-data?device_id=${deviceIds}&mode=latest&zonawaktu=WIB`,
        {
          headers: { Authorization: `Bearer ${API_TOKEN}` }
        }
      );

      //  console.log('📡 RESPONSE API:', res.data);

      // Map data terakhir per device
      const latestMap = {};
      if (res.data?.status && Array.isArray(res.data.data)) {
        res.data.data.forEach(d => {
          latestMap[d.device_unique_id] = d;
        });
      }


      let online = 0;
      let offline = 0;

      // Hitung status online / offline
      const updated = userList.map(u => {
        // Jika alat non-aktif → OFFLINE
        if (u.status === "0") {
          offline++;
          return {
            ...u,
            is_online: false,
            last_data: null
          };
        }

        const last = latestMap[u.device_unique_id];

        const isOnline = last
          ? isDeviceOnline(last.recorded_at)
          : false;

        isOnline ? online++ : offline++;

        return {
          ...u,
          is_online: isOnline,
          last_data: last ?? null
        };
      });

      // 🔍 LOG DETAIL ONLINE / OFFLINE
      const onlineUsers = updated.filter(u => u.is_online);
      const offlineUsers = updated.filter(u => !u.is_online);

      // console.log('🕒 CHECK TIME:', new Date().toLocaleString());

      //  console.log('🟢 ONLINE USERS:', onlineUsers.map(u => ({
      //  username: u.username,
      //   device_id: u.device_unique_id,
      //   last_seen: u.last_data?.recorded_at ?? 'NO DATA'
      //  })));

      //  console.log('🔴 OFFLINE USERS:', offlineUsers.map(u => ({
      //    username: u.username,
      //   device_id: u.device_unique_id,
      //     last_seen: u.last_data?.recorded_at ?? 'NO DATA'
      // })));

      // console.log(`📊 SUMMARY → ONLINE: ${online} | OFFLINE: ${offline}`);

      // Update state
      setUsers(updated);
      setFilteredUsers(updated);
      setDeviceStatus(prev => ({
        ...prev,
        online,
        offline
      }));

    } catch (error) {
      console.error('❌ checkOnlineStatus error:', error);
    } finally {
      setCheckingStatus(false);
    }
  };


  const refreshOnlineStatus = async () => {
    if (users.length > 0) {
      await checkOnlineStatus(users);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // --- Filter Functions ---
  const filterUsers = () => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.device_unique_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.city?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    switch (statusFilter) {
      case 'online':
        filtered = filtered.filter(u => u.is_online);
        break;
      case 'offline':
        filtered = filtered.filter(u => !u.is_online && u.status === "1");
        break;
      case 'active':
        filtered = filtered.filter(u => u.status === "1");
        break;
      case 'inactive':
        filtered = filtered.filter(u => u.status === "0");
        break;
      default:
        break;
    }

    setFilteredUsers(filtered);
  };

  useEffect(() => {
    filterUsers();
  }, [searchQuery, statusFilter, users]);

  // --- Action Handlers ---
  const handleOpenAdd = () => {
    setFormData({
      username: '',
      password: '',
      dev_name: '',
      dev_type: '',
      dev_id: '',
      owner: '',
      city: '',
      location: '',
      internet_no: '',
      pic_name: '',
      pic_contact: '',
      timezone: 'WIB',
      statusAlat: '1'
    });
    setParamsList([{
      label: '',
      topic: '',
      unit: '',
      is_visible: true,
      is_chart: false,
      chart_order: 1,
      chart_data: ''
    }]);
    setActiveTab('general');
    setModalMode('add');
  };

  const handleOpenEdit = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.get(`${BASE_URL}/api-app/admin/ds.php?action=get_device_config&device_unique_id=${user.device_unique_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status) {
        const mappedParams = res.data.settings.map(s => ({
          id: s.id,
          label: s.parameter_name,
          topic: s.mqtt_topic,
          unit: s.unit,
          is_visible: s.is_visible == 1,
          is_chart: s.is_chart == 1 || s.is_chart === true,
          chart_order: parseInt(s.chart_order) || 10,
          chart_data: s.chart_data || s.data_key || ''
        }));
        setParamsList(mappedParams);
        setFormData({
          awlr_height: res.data.awlr_height || '',
          timezone: res.data.timezone || 'WIB',
          statusAlat: res.data.statusAlat || '1',
          awlrData: res.data.awlrData || '',
          awlrStatusData: res.data.awlrStatusData || '1',
          awlrJenis: res.data.awlrJenis || 'sungai',
        });
        setActiveTab('general');
        setModalMode('edit');
      }
    } catch (e) {
      Alert.alert("Error", "Gagal memuat konfigurasi");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = (user) => {
    setSelectedUser(user);
    setModalMode('details');
  };

  const applyTemplate = (type) => {
    if (!type || !templates[type]) return;
    const newParams = templates[type].params.map(p => ({
      label: p.n,
      topic: `temins_iot/${formData.dev_id || 'ID'}/data/${p.k}`,
      unit: p.u,
      chart_data: p.d,
      is_visible: true,
      is_chart: !!p.d,
      chart_order: 10,
    }));
    setParamsList(newParams);
    setFormData({ ...formData, dev_type: type });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      let payload = { action: '', params: paramsList };

      if (modalMode === 'add') {
        payload = { ...payload, action: 'create_user', ...formData };
      } else if (modalMode === 'edit') {
        payload = {
          ...payload,
          action: 'update_config',
          user_id: selectedUser.id,
          device_unique_id: selectedUser.device_unique_id,
          ...formData
        };
      } else if (modalMode === 'password') {
        payload = { action: 'change_password', user_id: selectedUser.id, new_password: formData.new_password };
      }

      const res = await axios.post(`${BASE_URL}/api-app/admin/ds.php`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status) {
        Alert.alert("Sukses", res.data.message);
        setModalMode('none');
        fetchData();
      } else {
        Alert.alert("Gagal", res.data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (user) => {
    Alert.alert(
      "Hapus Perangkat",
      `Yakin hapus ${user.username}? Semua data akan hilang permanen.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus", style: "destructive", onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('user_token');
              await axios.post(`${BASE_URL}/api-app/admin/ds.php`, {
                action: 'delete_user',
                user_id: user.id,
                device_unique_id: user.device_unique_id
              }, { headers: { Authorization: `Bearer ${token}` } });
              fetchData();
            } catch (e) { Alert.alert("Error", "Gagal menghapus"); }
          }
        }
      ]
    );
  };

  const handleDeleteParam = async (index) => {
    if (modalMode === 'edit' && paramsList[index].id) {
      Alert.alert(
        "Hapus Parameter",
        "Hapus parameter ini permanen dari database?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Hapus", style: "destructive", onPress: async () => {
              try {
                const token = await AsyncStorage.getItem('user_token');
                await axios.post(`${BASE_URL}/api-app/admin/ds.php`,
                  { action: 'delete_param', id: paramsList[index].id },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const newList = [...paramsList];
                newList.splice(index, 1);
                setParamsList(newList);
              } catch (e) {
                Alert.alert("Error", "Gagal menghapus parameter");
              }
            }
          }
        ]
      );
    } else {
      const newList = [...paramsList];
      newList.splice(index, 1);
      setParamsList(newList);
    }
  };

  // --- UI Components ---

  const StatCard = ({ label, value, subValue, icon: Icon, color, onPress }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
          <Icon size={20} color={color} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statSub}>{subValue}</Text>
    </TouchableOpacity>
  );

  const FilterButton = ({ label, value, isActive }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.filterBtn,
          isActive && styles.filterBtnActive,
        ]}
        onPress={() => setStatusFilter(value)}
      >
        <Text
          style={[
            styles.filterText,
            isActive && styles.filterTextActive,
          ]}
          numberOfLines={1}
        >
          {String(label)}
        </Text>
      </TouchableOpacity>
    );
  };


  const DeviceCard = ({ user }) => {
    const DeviceIcon = getDeviceIcon(user.device_type);
    const statusColor = getStatusColor(user.status, user.is_online);
    const statusText = getStatusText(user.status, user.is_online);

    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => handleOpenDetails(user)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: statusColor + '20' }]}>
              <DeviceIcon size={20} color={statusColor} />
            </View>
            <View>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.ownerText}>{user.owner_name || 'No Owner'}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Wifi size={14} color={user.is_online ? '#22c55e' : '#94a3b8'} />
            <Text style={[styles.infoText, { color: user.is_online ? '#22c55e' : '#64748b' }]}>
              {user.is_online ? "Online" : "Offline"}
            </Text>
            <Text style={styles.divider}>•</Text>
            <MapPin size={14} color="#64748b" />
            <Text style={styles.infoText}>{user.city || 'No Location'}</Text>
          </View>

          <View style={styles.idContainer}>
            <Text style={styles.idLabel}>Device ID:</Text>
            <Text style={styles.idValue}>{user.device_unique_id}</Text>
            <View style={[styles.typeBadge, { backgroundColor: statusColor + '10' }]}>
              <Text style={[styles.typeText, { color: statusColor }]}>{user.device_type || 'Custom'}</Text>
            </View>
          </View>

          {user.last_data && (
            <View style={styles.lastDataContainer}>
              <Text style={styles.lastDataLabel}>Last Data:</Text>
              <Text style={styles.lastDataValue}>
                {user.last_data.value} {user.last_data.parameter_name}
              </Text>
              <Text style={styles.lastDataTime}>
                {new Date(user.last_data.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnConfig]}
            onPress={() => handleOpenEdit(user)}
          >
            <Settings size={18} color="#4f46e5" />
            <Text style={styles.btnActionText}>Config</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnPass]}
            onPress={() => { setSelectedUser(user); setModalMode('password'); }}
          >
            <Key size={18} color="#d97706" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnTrash]}
            onPress={() => handleDelete(user)}
          >
            <Trash2 size={18} color="#e11d48" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}></Text>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>IoT Device Management System</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={refreshOnlineStatus}
            disabled={checkingStatus}
            style={styles.iconBtn}
          >
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <RotateCw size={22} color={checkingStatus ? "#6366f1" : "#475569"} />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.filterIcon]}
            onPress={() => setStatusFilter(statusFilter === 'all' ? 'online' : 'all')}
          >
            <Filter size={22} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari perangkat..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <FilterButton label="Semua" value="all" isActive={statusFilter === 'all'} />
        <FilterButton label="Online" value="online" isActive={statusFilter === 'online'} />
        <FilterButton label="Offline" value="offline" isActive={statusFilter === 'offline'} />
        <FilterButton label="Aktif" value="active" isActive={statusFilter === 'active'} />
        <FilterButton label="Nonaktif" value="inactive" isActive={statusFilter === 'inactive'} />
        <FilterButton label="AWLR" value="awlr" isActive={statusFilter === 'awlr'} />
        <FilterButton label="AWS" value="aws" isActive={statusFilter === 'aws'} />
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >

        {/* Stats Section */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Perangkat"
            value={users.length}
            subValue={`${deviceStatus.aktif} Aktif`}
            icon={Cpu}
            color="#6366f1"
            onPress={() => setStatusFilter('all')}
          />
          <StatCard
            label="Online"
            value={deviceStatus.online}
            subValue="Update ≤ 30m"
            icon={Wifi}
            color="#22c55e"
            onPress={() => setStatusFilter('online')}
          />
          <StatCard
            label="Offline"
            value={deviceStatus.offline}
            subValue="Update > 30m"
            icon={WifiOff}
            color="#f97316"
            onPress={() => setStatusFilter('offline')}
          />
          <StatCard
            label="Nonaktif"
            value={deviceStatus.nonaktif}
            subValue="Device Inactive"
            icon={Power}
            color="#ef4444"
            onPress={() => setStatusFilter('inactive')}
          />
        </View>

        {/* Device List Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daftar Perangkat ({filteredUsers.length})</Text>
          <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
            <RotateCw size={16} color="#6366f1" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading && users.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Memuat data perangkat...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Cpu size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Tidak Ada Perangkat</Text>
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'all'
                ? "Tidak ada perangkat yang sesuai dengan filter"
                : "Tambahkan perangkat pertama Anda"}
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={handleOpenAdd}>
              <Plus size={20} color="white" />
              <Text style={styles.emptyBtnText}>Tambah Perangkat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <DeviceCard key={user.id} user={user} />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* === MODALS === */}

      {/* Modal: ADD */}
      <Modal visible={modalMode === 'add'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tambah Perangkat Baru</Text>
            <TouchableOpacity onPress={() => setModalMode('none')} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'general' && styles.activeTab]}
                onPress={() => setActiveTab('general')}
              >
                <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>
                  Umum
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'location' && styles.activeTab]}
                onPress={() => setActiveTab('location')}
              >
                <Text style={[styles.tabText, activeTab === 'location' && styles.activeTabText]}>
                  Lokasi
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sensors' && styles.activeTab]}
                onPress={() => setActiveTab('sensors')}
              >
                <Text style={[styles.tabText, activeTab === 'sensors' && styles.activeTabText]}>
                  Sensor
                </Text>
              </TouchableOpacity>
            </View>

            {/* General Tab */}
            {activeTab === 'general' && (
              <View style={styles.tabContent}>
                <Text style={styles.inputLabel}>Username *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.username}
                  onChangeText={(t) => setFormData({ ...formData, username: t })}
                  placeholder="Username login"
                />

                <Text style={styles.inputLabel}>Password *</Text>
                <View style={styles.passwordInput}>
                  <TextInput
                    style={styles.passwordTextInput}
                    secureTextEntry={!showPassword}
                    value={formData.password}
                    onChangeText={(t) => setFormData({ ...formData, password: t })}
                    placeholder="Password perangkat"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Nama Perangkat *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dev_name}
                  onChangeText={(t) => setFormData({ ...formData, dev_name: t })}
                  placeholder="Contoh: Smart Farming v1"
                />

                <Text style={styles.inputLabel}>Device ID (MQTT Client ID) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dev_id}
                  onChangeText={(t) => setFormData({ ...formData, dev_id: t })}
                  placeholder="Contoh: ESP32_01"
                />

                <Text style={styles.inputLabel}>Zona Waktu *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.timezone}
                    onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="WIB" value="WIB" />
                    <Picker.Item label="WITA" value="WITA" />
                    <Picker.Item label="WIT" value="WIT" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Status Alat</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.statusAlat}
                    onValueChange={(v) => setFormData({ ...formData, statusAlat: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Aktif" value="1" />
                    <Picker.Item label="Tidak Aktif" value="0" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Pilih Template</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.dev_type}
                    onValueChange={applyTemplate}
                    style={styles.picker}
                  >
                    <Picker.Item label="-- Pilih Template --" value="" />
                    {Object.keys(templates).map(k => (
                      <Picker.Item key={k} label={templates[k].name} value={k} />
                    ))}
                  </Picker>
                </View>

                <TouchableOpacity
                  style={styles.advancedToggle}
                  onPress={() => setShowAdvancedConfig(!showAdvancedConfig)}
                >
                  <Text style={styles.advancedToggleText}>
                    {showAdvancedConfig ? 'Sembunyikan' : 'Tampilkan'} Konfigurasi Lanjutan
                  </Text>
                  <ChevronDown size={16} color="#6366f1" />
                </TouchableOpacity>

                {showAdvancedConfig && (
                  <View style={styles.advancedConfig}>
                    <Text style={styles.inputLabel}>Owner Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.owner}
                      onChangeText={(t) => setFormData({ ...formData, owner: t })}
                      placeholder="Nama pemilik/instansi"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Location Tab */}
            {activeTab === 'location' && (
              <View style={styles.tabContent}>
                <Text style={styles.inputLabel}>Kota/Kabupaten</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(t) => setFormData({ ...formData, city: t })}
                  placeholder="Contoh: Jakarta"
                />

                <Text style={styles.inputLabel}>Lokasi</Text>
                <TextInput
                  style={styles.input}
                  value={formData.location}
                  onChangeText={(t) => setFormData({ ...formData, location: t })}
                  placeholder="Contoh: Semarang"
                />

                <Text style={styles.inputLabel}>No. IoT SIM</Text>
                <TextInput
                  style={styles.input}
                  value={formData.internet_no}
                  onChangeText={(t) => setFormData({ ...formData, internet_no: t })}
                  placeholder="Nomor SIM kartu IoT"
                />

                <Text style={styles.inputLabel}>Nama PIC</Text>
                <TextInput
                  style={styles.input}
                  value={formData.pic_name}
                  onChangeText={(t) => setFormData({ ...formData, pic_name: t })}
                  placeholder="Nama PIC"
                />

                <Text style={styles.inputLabel}>Kontak PIC</Text>
                <TextInput
                  style={styles.input}
                  value={formData.pic_contact}
                  onChangeText={(t) => setFormData({ ...formData, pic_contact: t })}
                  placeholder="No. HP atau email"
                />
              </View>
            )}

            {/* Sensors Tab */}
            {activeTab === 'sensors' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Daftar Sensor / Parameter</Text>
                  <TouchableOpacity
                    style={styles.miniAddBtn}
                    onPress={() => setParamsList([...paramsList, {
                      label: '',
                      topic: `temins_iot/${formData.dev_id || 'ID'}/data/`,
                      unit: '',
                      is_visible: true,
                      is_chart: false,
                      chart_order: 10,
                      chart_data: ''
                    }])}
                  >
                    <Plus size={16} color="white" />
                    <Text style={styles.miniAddText}>Tambah</Text>
                  </TouchableOpacity>
                </View>

                {paramsList.map((p, idx) => (
                  <View key={idx} style={styles.paramCard}>
                    <View style={styles.paramHeader}>
                      <Text style={styles.paramIndex}>Sensor {idx + 1}</Text>
                      <TouchableOpacity onPress={() => handleDeleteParam(idx)}>
                        <Trash2 size={20} color="#e11d48" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Nama Sensor</Text>
                    <TextInput
                      style={styles.input}
                      value={p.label}
                      onChangeText={(t) => {
                        let n = [...paramsList];
                        n[idx].label = t;
                        setParamsList(n);
                      }}
                      placeholder="Contoh: Temperature"
                    />

                    <Text style={styles.inputLabel}>Topic MQTT</Text>
                    <TextInput
                      style={styles.input}
                      value={p.topic}
                      onChangeText={(t) => {
                        let n = [...paramsList];
                        n[idx].topic = t;
                        setParamsList(n);
                      }}
                      placeholder="temins_iot/device/data/sensor"
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.inputLabel}>Unit</Text>
                        <TextInput
                          style={styles.input}
                          value={p.unit}
                          onChangeText={(t) => {
                            let n = [...paramsList];
                            n[idx].unit = t;
                            setParamsList(n);
                          }}
                          placeholder="°C, %, etc"
                        />
                      </View>

                      <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>Chart</Text>
                        <Switch
                          value={p.is_chart}
                          onValueChange={(v) => {
                            let n = [...paramsList];
                            n[idx].is_chart = v;
                            setParamsList(n);
                          }}
                          trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                          thumbColor="white"
                        />
                      </View>
                    </View>

                    {p.is_chart && (
                      <>
                        <Text style={styles.inputLabel}>Chart Key (JSON Path)</Text>
                        <TextInput
                          style={styles.input}
                          value={p.chart_data}
                          onChangeText={(t) => {
                            let n = [...paramsList];
                            n[idx].chart_data = t;
                            setParamsList(n);
                          }}
                          placeholder="data.temperature"
                        />

                        <Text style={styles.inputLabel}>Chart Order</Text>
                        <TextInput
                          style={styles.input}
                          value={String(p.chart_order)}
                          onChangeText={(t) => {
                            let n = [...paramsList];
                            n[idx].chart_order = parseInt(t) || 10;
                            setParamsList(n);
                          }}
                          placeholder="Urutan grafik"
                          keyboardType="numeric"
                        />
                      </>
                    )}

                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>Visible di Dashboard</Text>
                      <Switch
                        value={p.is_visible}
                        onValueChange={(v) => {
                          let n = [...paramsList];
                          n[idx].is_visible = v;
                          setParamsList(n);
                        }}
                        trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                        thumbColor="white"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 50 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.footerBtnCancel}
              onPress={() => setModalMode('none')}
            >
              <Text style={styles.footerBtnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerBtnSave}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Save size={20} color="white" />
                  <Text style={styles.footerBtnText}>Simpan Perangkat</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal: EDIT */}
      <Modal visible={modalMode === 'edit'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Konfigurasi</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.username}</Text>
            <TouchableOpacity onPress={() => setModalMode('none')} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            {/* AWLR Configuration */}
            {selectedUser?.device_type === 'AWLR' && (
              <View style={styles.awlrConfig}>
                <View style={styles.awlrHeader}>
                  <Ruler size={24} color="#0ea5e9" />
                  <Text style={styles.awlrTitle}>Konfigurasi AWLR</Text>
                </View>
                <Text style={styles.awlrSubtitle}>Pengaturan sensor ketinggian air</Text>

                <Text style={styles.inputLabel}>Tinggi Sensor (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.awlr_height}
                  onChangeText={(t) => setFormData({ ...formData, awlr_height: t })}
                  placeholder="0"
                  keyboardType="numeric"
                />
                <Text style={styles.inputLabel}>Jenis AWLR</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.awlrJenis}
                    onValueChange={(v) => setFormData({ ...formData, awlrJenis: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sungai" value="sungai" />
                    <Picker.Item label="Sumur" value="sumur" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Data Sensor AWLR</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.awlrData}
                    onValueChange={(v) => setFormData({ ...formData, awlrData: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="-- Pilih Sensor --" value="" />
                    {paramsList.map((param, idx) => (
                      <Picker.Item
                        key={idx}
                        label={`${param.label} (${param.chart_data})`}
                        value={param.chart_data}
                      />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Pengurangan Data</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.awlrStatusData}
                    onValueChange={(v) => setFormData({ ...formData, awlrStatusData: v })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Aktif" value="1" />
                    <Picker.Item label="Tidak Aktif" value="0" />
                  </Picker>
                </View>
              </View>
            )}

            {/* General Configuration */}
            <View style={styles.formSection}>
              <Text style={styles.sectionHeader}>Pengaturan Umum</Text>

              <Text style={styles.inputLabel}>Zona Waktu</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.timezone}
                  onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                  style={styles.picker}
                >
                  <Picker.Item label="WIB" value="WIB" />
                  <Picker.Item label="WITA" value="WITA" />
                  <Picker.Item label="WIT" value="WIT" />
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Status Alat</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.statusAlat}
                  onValueChange={(v) => setFormData({ ...formData, statusAlat: v })}
                  style={styles.picker}
                >
                  <Picker.Item label="Aktif" value="1" />
                  <Picker.Item label="Tidak Aktif" value="0" />
                </Picker>
              </View>
            </View>

            {/* Sensor Configuration */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Daftar Sensor / Parameter</Text>
                <TouchableOpacity
                  style={styles.miniAddBtn}
                  onPress={() => setParamsList([...paramsList, {
                    label: '',
                    topic: `temins_iot/${selectedUser?.device_unique_id || 'ID'}/data/`,
                    unit: '',
                    is_visible: true,
                    is_chart: false,
                    chart_order: 10,
                    chart_data: ''
                  }])}
                >
                  <Plus size={16} color="white" />
                  <Text style={styles.miniAddText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {paramsList.map((p, idx) => (
                <View key={idx} style={styles.paramCard}>
                  <View style={styles.paramHeader}>
                    <Text style={styles.paramIndex}>Sensor {idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteParam(idx)}>
                      <Trash2 size={20} color="#e11d48" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>Nama Sensor</Text>
                  <TextInput
                    style={styles.input}
                    value={p.label}
                    onChangeText={(t) => {
                      let n = [...paramsList];
                      n[idx].label = t;
                      setParamsList(n);
                    }}
                    placeholder="Contoh: Temperature"
                  />

                  <Text style={styles.inputLabel}>Topic MQTT</Text>
                  <TextInput
                    style={styles.input}
                    value={p.topic}
                    onChangeText={(t) => {
                      let n = [...paramsList];
                      n[idx].topic = t;
                      setParamsList(n);
                    }}
                    placeholder="temins_iot/device/data/sensor"
                  />

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.inputLabel}>Unit</Text>
                      <TextInput
                        style={styles.input}
                        value={p.unit}
                        onChangeText={(t) => {
                          let n = [...paramsList];
                          n[idx].unit = t;
                          setParamsList(n);
                        }}
                        placeholder="°C, %, etc"
                      />
                    </View>

                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>Chart</Text>
                      <Switch
                        value={p.is_chart}
                        onValueChange={(v) => {
                          let n = [...paramsList];
                          n[idx].is_chart = v;
                          setParamsList(n);
                        }}
                        trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                        thumbColor="white"
                      />
                    </View>
                  </View>

                  {p.is_chart && (
                    <>
                      <Text style={styles.inputLabel}>Chart Key (JSON Path)</Text>
                      <TextInput
                        style={styles.input}
                        value={p.chart_data}
                        onChangeText={(t) => {
                          let n = [...paramsList];
                          n[idx].chart_data = t;
                          setParamsList(n);
                        }}
                        placeholder="data.temperature"
                      />

                      <Text style={styles.inputLabel}>Chart Order</Text>
                      <TextInput
                        style={styles.input}
                        value={String(p.chart_order)}
                        onChangeText={(t) => {
                          let n = [...paramsList];
                          n[idx].chart_order = parseInt(t) || 10;
                          setParamsList(n);
                        }}
                        placeholder="Urutan grafik"
                        keyboardType="numeric"
                      />
                    </>
                  )}

                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Visible di Dashboard</Text>
                    <Switch
                      value={p.is_visible}
                      onValueChange={(v) => {
                        let n = [...paramsList];
                        n[idx].is_visible = v;
                        setParamsList(n);
                      }}
                      trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                      thumbColor="white"
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.footerBtnCancel}
              onPress={() => setModalMode('none')}
            >
              <Text style={styles.footerBtnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerBtnSave}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Save size={20} color="white" />
                  <Text style={styles.footerBtnText}>Simpan Konfigurasi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal: DETAILS */}
      <Modal visible={modalMode === 'details'} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Detail Perangkat</Text>
              <Text style={styles.modalSubtitle}>{selectedUser?.username}</Text>
            </View>
            <TouchableOpacity onPress={() => setModalMode('none')} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            {selectedUser && (
              <>
                {/* Device Info Card */}
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    {(() => {
                      const DeviceIcon = getDeviceIcon(selectedUser.device_type);
                      return <DeviceIcon size={32} color="#6366f1" />;
                    })()}
                    <View style={styles.detailTitleContainer}>
                      <Text style={styles.detailTitle}>{selectedUser.device_name || selectedUser.username}</Text>
                      <Text style={styles.detailSubtitle}>{selectedUser.device_type || 'Custom Device'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Device ID</Text>
                      <Text style={styles.detailValue} selectable>{selectedUser.device_unique_id}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Pemilik</Text>
                      <Text style={styles.detailValue}>{selectedUser.owner_name || '-'}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Lokasi</Text>
                      <Text style={styles.detailValue}>{selectedUser.city || '-'}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View style={styles.statusContainer}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(selectedUser.status, selectedUser.is_online) }
                        ]} />
                        <Text style={[
                          styles.statusText,
                          { color: getStatusColor(selectedUser.status, selectedUser.is_online) }
                        ]}>
                          {getStatusText(selectedUser.status, selectedUser.is_online)}
                        </Text>
                      </View>
                    </View>

                    {selectedUser.last_data && (
                      <>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Data Terakhir</Text>
                          <Text style={styles.detailValue}>
                            {selectedUser.last_data.value} {selectedUser.last_data.parameter_name}
                          </Text>
                        </View>

                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Waktu Update</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedUser.last_data.recorded_at).toLocaleString()}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => {
                      setModalMode('none');
                      setTimeout(() => handleOpenEdit(selectedUser), 300);
                    }}
                  >
                    <Settings size={20} color="#4f46e5" />
                    <Text style={styles.actionButtonText}>Edit Config</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.passwordButton]}
                    onPress={() => {
                      setModalMode('none');
                      setTimeout(() => {
                        setSelectedUser(selectedUser);
                        setModalMode('password');
                      }, 300);
                    }}
                  >
                    <Key size={20} color="#d97706" />
                    <Text style={styles.actionButtonText}>Ganti Password</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal: CHANGE PASSWORD */}
      <Modal visible={modalMode === 'password'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.smallModal}>
            <View style={styles.smallModalHeader}>
              <Key size={24} color="#6366f1" />
              <Text style={styles.smallModalTitle}>Ganti Password</Text>
            </View>

            <Text style={styles.smallModalSubtitle}>{selectedUser?.username}</Text>

            <View style={styles.passwordInput}>
              <TextInput
                style={styles.smallModalInput}
                secureTextEntry={!showPassword}
                placeholder="Password Baru"
                value={formData.new_password}
                onChangeText={(t) => setFormData({ new_password: t })}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
              </TouchableOpacity>
            </View>

            <View style={styles.smallModalActions}>
              <TouchableOpacity
                style={styles.smallModalCancel}
                onPress={() => setModalMode('none')}
              >
                <Text style={styles.smallModalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallModalConfirm}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.smallModalConfirmText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  filterIcon: {
    backgroundColor: '#f1f5f9',
  },
  addBtn: {
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Search Styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#0f172a',
  },

  // Filter Styles
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 60, // ⬅️ WAJIB
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#ffffffff',
  },
  filterBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000000ff',
  },
  filterTextActive: {
    color: '#ffffff',
  },

  // Scroll Content
  scrollContent: {
    padding: 20
  },

  // Stats Section
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20
  },
  statCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  statIcon: {
    padding: 8,
    borderRadius: 10
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSub: {
    fontSize: 10,
    color: '#94a3b8'
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b'
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },

  // Loading & Empty States
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  // Device Card Styles
  deviceCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  ownerText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
  },
  divider: {
    color: '#cbd5e1',
    fontSize: 10,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  idLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  idValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  lastDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastDataLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  lastDataValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    flex: 1,
  },
  lastDataTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
  },
  btnConfig: {
    borderColor: '#e0e7ff',
    backgroundColor: '#f5f7ff',
  },
  btnPass: {
    borderColor: '#fef3c7',
    backgroundColor: '#fffbeb',
  },
  btnTrash: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4f46e5',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalForm: {
    flex: 1,
    padding: 20,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#6366f1',
  },
  tabContent: {
    gap: 16,
  },

  // Form Elements
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000ff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#000000ff',
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  passwordTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  pickerContainer: {
    color: '#ff0000ff',
    backgroundColor: '#ffffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0870f7ff',
    overflow: 'hidden',
  },
  picker: {
    color: '#000000ff',
    height: 50,
  },

  // Advanced Config
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  advancedToggleText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  advancedConfig: {
    marginTop: 8,
  },

  // AWLR Config
  awlrConfig: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  awlrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  awlrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  awlrSubtitle: {
    fontSize: 12,
    color: '#38bdf8',
    marginBottom: 16,
  },

  // Form Sections
  formSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Parameter Cards
  paramCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paramIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  miniAddText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  footerBtnCancel: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
  },
  footerBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  footerBtnSave: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  footerBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Detail Modal
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  detailTitleContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  detailSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  detailGrid: {
    gap: 16,
  },
  detailItem: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  passwordButton: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Small Modal (Password Change)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  smallModal: {
    backgroundColor: 'white',
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  smallModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  smallModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  smallModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  smallModalInput: {

    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  smallModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  smallModalCancel: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  smallModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  smallModalConfirm: {
    flex: 2,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  smallModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});