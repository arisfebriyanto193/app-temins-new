import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  Plus,
  Cpu,
  Trash2,
  Settings,
  List,
  Box,
  CheckCircle,
  PenSquare,
  X,
  Edit,
  Hash,
  FileText,
  BarChart3,
  RotateCw,
  Search,
  AlertCircle,
  ChevronRight,
  Layers,
  Copy,
  HardDrive,
  Server,
  Database,
  Network,
  Wifi,
  Power,
  Eye,
  EyeOff,
  Filter,
  Key,
  Save,
} from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// === TYPES ===
interface Device {
  dev_id: string;
  use_default: boolean;
  topic: string[];
}

interface DeviceTypeConfig {
  def_topic: string[];
  devices: Device[];
}

interface RootData {
  device_type: Record<string, DeviceTypeConfig>;
}

export default function TopicConfiguration() {
  // --- STATE ---
  const [data, setData] = useState<RootData>({ device_type: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [modals, setModals] = useState({
    addType: false,
    defTopic: false,
    addDevice: false,
    editDevice: false,
    deviceList: false
  });

  // Form Data States
  const [formData, setFormData] = useState({
    targetType: '',
    targetIndex: -1,
    inputType: '',
    inputDefTopic: '',
    inputDevId: '',
    editUseDefault: false,
    editTopic: '',
    editDevId: ''
  });

  // Animation
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // API Config
  const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
  const API_URL = `${BASE_URL}/api-app/admin/set_rec.php`;

  // --- FETCH DATA ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(API_URL);
      
      if (res.data.status && res.data.data) {
        const cleanData = Array.isArray(res.data.data.device_type) 
          ? { device_type: {} } 
          : res.data.data;
        setData(cleanData);
      } else {
        Alert.alert('Error', 'Gagal memuat data');
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      Alert.alert('Error', 'Gagal terhubung ke server');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // --- API ACTIONS ---
  const handleApiAction = async (payload: any) => {
    try {
      const res = await axios.post(API_URL, payload);
      
      if (res.data.status) {
        showToast(res.data.message || 'Berhasil', 'success');
        fetchData();
        closeAllModals();
      } else {
        showToast(res.data.message || 'Gagal', 'error');
      }
    } catch (error) {
      console.error('API action error:', error);
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    
    // Animate toast in
    Animated.spring(toastAnim, {
      toValue: 20,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();

    // Auto hide after 4 seconds
    setTimeout(() => {
      Animated.spring(toastAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start(() => setToast(null));
    }, 4000);
  };

  const closeAllModals = () => {
    setModals({ 
      addType: false, 
      defTopic: false, 
      addDevice: false, 
      editDevice: false, 
      deviceList: false 
    });
    setFormData(prev => ({ 
      ...prev, 
      inputType: '', 
      inputDefTopic: '', 
      inputDevId: '',
      editUseDefault: false,
      editTopic: '',
      editDevId: ''
    }));
  };

  // --- UI HANDLERS ---
  const openDefTopic = (type: string, topics: string[]) => {
    setFormData(prev => ({ 
      ...prev, 
      targetType: type, 
      inputDefTopic: topics.join(', ') 
    }));
    setModals(prev => ({ ...prev, defTopic: true }));
  };

  const openDeviceList = (type: string) => {
    setFormData(prev => ({ ...prev, targetType: type }));
    setModals(prev => ({ ...prev, deviceList: true }));
  };

  const openAddDeviceFromList = () => {
    setModals(prev => ({ ...prev, deviceList: false, addDevice: true }));
  };

  const openEditDevice = (index: number, devId: string, useDefault: boolean, topics: string[]) => {
    setFormData(prev => ({
      ...prev,
      targetIndex: index,
      editDevId: devId,
      editUseDefault: useDefault,
      editTopic: topics.join(', ')
    }));
    setModals(prev => ({ ...prev, deviceList: false, editDevice: true }));
  };

  const handleDeleteType = (type: string) => {
    Alert.alert(
      'Hapus Tipe Perangkat',
      'Hapus tipe ini beserta semua devicenya?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: () => handleApiAction({ 
            action: 'delete_device_type', 
            device_type: type 
          })
        }
      ]
    );
  };

  const handleDeleteDevice = () => {
    Alert.alert(
      'Hapus Device',
      'Yakin ingin menghapus device ini selamanya?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: () => handleApiAction({ 
            action: 'delete_device', 
            device_type: formData.targetType, 
            index: formData.targetIndex 
          })
        }
      ]
    );
  };

  const backToDeviceList = () => {
    setModals(prev => ({ 
      ...prev, 
      addDevice: false, 
      editDevice: false, 
      deviceList: true 
    }));
  };

  // --- UI COMPONENTS ---
  const DeviceTypeCard = ({ type, config }: { type: string; config: DeviceTypeConfig }) => (
    <View style={styles.typeCard}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.typeIcon}>
          <Cpu size={24} color="#6366f1" />
        </View>
        <View style={styles.typeInfo}>
          <Text style={styles.typeName}>{type}</Text>
          <View style={styles.deviceCount}>
            <Text style={styles.deviceCountText}>
              {config.devices.length} perangkat terdaftar
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteTypeBtn}
          onPress={() => handleDeleteType(type)}
        >
          <Trash2 size={18} color="#e11d48" />
        </TouchableOpacity>
      </View>

      {/* Card Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.defaultTopicBtn]}
          onPress={() => openDefTopic(type, config.def_topic)}
        >
          <Settings size={18} color="#22c55e" />
          <Text style={styles.actionBtnText}>Default Topic</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.manageDevicesBtn]}
          onPress={() => openDeviceList(type)}
        >
          <List size={18} color="#6366f1" />
          <Text style={styles.actionBtnText}>Kelola Perangkat</Text>
          <View style={styles.deviceCountBadge}>
            <Text style={styles.deviceCountBadgeText}>{config.devices.length}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const DeviceCard = ({ device, index }: { device: Device; index: number }) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceIcon}>
          <Cpu size={20} color="#6366f1" />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceId}>{device.dev_id}</Text>
          <View style={[
            styles.modeBadge,
            device.use_default ? styles.defaultBadge : styles.customBadge
          ]}>
            {device.use_default ? (
              <>
                <CheckCircle size={12} color="#22c55e" />
                <Text style={styles.modeText}>Default Mode</Text>
              </>
            ) : (
              <>
                <PenSquare size={12} color="#f97316" />
                <Text style={styles.modeText}>Custom Mode</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.editDeviceBtn}
          onPress={() => openEditDevice(index, device.dev_id, device.use_default, device.topic)}
        >
          <Edit size={18} color="#4f46e5" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {!device.use_default && device.topic.length > 0 && (
        <View style={styles.topicsContainer}>
          <Text style={styles.topicsLabel}>Topics:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.topicsScroll}
          >
            {device.topic.map((topic, idx) => (
              <View key={idx} style={styles.topicChip}>
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Toast Notification */}
      {toast && (
        <Animated.View 
          style={[
            styles.toast,
            { 
              transform: [{ translateY: toastAnim }],
              borderLeftColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
              backgroundColor: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            }
          ]}
        >
          <View style={styles.toastContent}>
            <View style={[
              styles.toastIcon,
              { backgroundColor: toast.type === 'success' ? '#22c55e20' : '#ef444420' }
            ]}>
              {toast.type === 'success' ? (
                <CheckCircle size={20} color="#22c55e" />
              ) : (
                <AlertCircle size={20} color="#ef4444" />
              )}
            </View>
            <View style={styles.toastText}>
              <Text style={[
                styles.toastTitle,
                { color: toast.type === 'success' ? '#166534' : '#991b1b' }
              ]}>
                {toast.type === 'success' ? 'Berhasil' : 'Error'}
              </Text>
              <Text style={styles.toastMessage}>{toast.msg}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                Animated.spring(toastAnim, {
                  toValue: -100,
                  useNativeDriver: true,
                  tension: 100,
                  friction: 10,
                }).start(() => setToast(null));
              }}
              style={styles.toastClose}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Topic Configuration</Text>
          <Text style={styles.headerSubtitle}>Kelola konfigurasi topic perangkat</Text>
        </View>
        <TouchableOpacity
          style={styles.addTypeBtn}
          onPress={() => setModals(prev => ({ ...prev, addType: true }))}
        >
          <Plus size={20} color="white" />
          <Text style={styles.addTypeText}>Tipe Baru</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari tipe perangkat..."
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

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#6366f115' }]}>
            <Layers size={24} color="#6366f1" />
          </View>
          <View>
            <Text style={styles.statValue}>
              {Object.keys(data.device_type || {}).length}
            </Text>
            <Text style={styles.statLabel}>Total Tipe</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#10b98115' }]}>
            <Cpu size={24} color="#10b981" />
          </View>
          <View>
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              {Object.values(data.device_type || {}).reduce(
                (acc, config) => acc + config.devices.length, 0
              )}
            </Text>
            <Text style={styles.statLabel}>Total Device</Text>
          </View>
        </View>
      </View>

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
        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Memuat data konfigurasi...</Text>
          </View>
        ) : Object.keys(data.device_type || {}).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Box size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Belum ada tipe perangkat</Text>
            <Text style={styles.emptyText}>
              Tambahkan tipe perangkat pertama Anda
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModals(prev => ({ ...prev, addType: true }))}
            >
              <Plus size={20} color="white" />
              <Text style={styles.emptyBtnText}>Tambah Tipe Perangkat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(data.device_type || {}).map(([type, config]) => (
            <DeviceTypeCard key={type} type={type} config={config} />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* === MODALS === */}

      {/* Add Type Modal */}
      <Modal
        visible={modals.addType}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <View style={styles.modalIcon}>
                <Plus size={24} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Tambah Tipe Perangkat</Text>
                <Text style={styles.modalSubtitle}>Buat tipe perangkat baru</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeAllModals} style={styles.modalCloseBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Tipe *</Text>
              <TextInput
                style={styles.input}
                value={formData.inputType}
                onChangeText={(text) => setFormData(prev => ({ ...prev, inputType: text }))}
                placeholder="Contoh: ESP32_CAM"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeAllModals}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleApiAction({ 
                  action: 'add_device_type', 
                  device_type: formData.inputType 
                })}
              >
                <Save size={20} color="white" />
                <Text style={styles.saveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Default Topic Modal */}
      <Modal
        visible={modals.defTopic}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: '#22c55e15' }]}>
                <Settings size={24} color="#22c55e" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Default Topics</Text>
                <Text style={styles.modalSubtitle}>{formData.targetType}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeAllModals} style={styles.modalCloseBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.infoBox}>
              <AlertCircle size={18} color="#22c55e" />
              <Text style={styles.infoText}>
                Topik ini otomatis digunakan oleh perangkat dengan mode "Default"
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Topics (pisahkan dengan koma) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.inputDefTopic}
                onChangeText={(text) => setFormData(prev => ({ ...prev, inputDefTopic: text }))}
                placeholder="topic/sensor1, topic/sensor2"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeAllModals}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#22c55e' }]}
                onPress={() => handleApiAction({ 
                  action: 'update_def_topic', 
                  device_type: formData.targetType, 
                  def_topic: formData.inputDefTopic 
                })}
              >
                <Save size={20} color="white" />
                <Text style={styles.saveBtnText}>Update Default</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Device List Modal */}
      <Modal
        visible={modals.deviceList}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: '#6366f115' }]}>
                <List size={24} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Kelola Perangkat</Text>
                <Text style={styles.modalSubtitle}>{formData.targetType}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeAllModals} style={styles.modalCloseBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.deviceListHeader}>
              <Text style={styles.deviceListCount}>
                Total: <Text style={styles.deviceListCountHighlight}>
                  {data.device_type[formData.targetType]?.devices.length || 0}
                </Text> perangkat
              </Text>
              <TouchableOpacity
                style={styles.addDeviceBtn}
                onPress={openAddDeviceFromList}
              >
                <Plus size={18} color="white" />
                <Text style={styles.addDeviceBtnText}>Tambah Device</Text>
              </TouchableOpacity>
            </View>

            {!data.device_type[formData.targetType]?.devices.length ? (
              <View style={styles.emptyDeviceList}>
                <Box size={48} color="#cbd5e1" />
                <Text style={styles.emptyDeviceTitle}>Belum ada perangkat</Text>
                <Text style={styles.emptyDeviceText}>
                  Klik tombol "Tambah Device" untuk menambahkan
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.deviceList} showsVerticalScrollIndicator={false}>
                {data.device_type[formData.targetType]?.devices.map((device, index) => (
                  <DeviceCard key={index} device={device} index={index} />
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Device Modal */}
      <Modal
        visible={modals.addDevice}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: '#6366f115' }]}>
                <Plus size={24} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Tambah Device</Text>
                <Text style={styles.modalSubtitle}>{formData.targetType}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={backToDeviceList} style={styles.modalCloseBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device ID / Serial *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={formData.inputDevId}
                onChangeText={(text) => setFormData(prev => ({ ...prev, inputDevId: text }))}
                placeholder="e.g. ESP32_Room1"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={backToDeviceList}>
                <Text style={styles.cancelBtnText}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleApiAction({ 
                  action: 'add_device', 
                  device_type: formData.targetType, 
                  dev_id: formData.inputDevId 
                })}
              >
                <Plus size={20} color="white" />
                <Text style={styles.saveBtnText}>Tambah Device</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Device Modal */}
      <Modal
        visible={modals.editDevice}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: '#6366f115' }]}>
                <Edit size={24} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Edit Device</Text>
                <Text style={styles.modalSubtitle}>{formData.targetType}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={backToDeviceList} style={styles.modalCloseBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device ID *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={formData.editDevId}
                onChangeText={(text) => setFormData(prev => ({ ...prev, editDevId: text }))}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setFormData(prev => ({ 
                  ...prev, 
                  editUseDefault: !prev.editUseDefault 
                }))}
              >
                <View style={[
                  styles.checkboxBox,
                  formData.editUseDefault && styles.checkboxBoxChecked
                ]}>
                  {formData.editUseDefault && (
                    <CheckCircle size={16} color="#6366f1" />
                  )}
                </View>
                <View style={styles.checkboxLabel}>
                  <Text style={styles.checkboxTitle}>Gunakan Default Topic</Text>
                  <Text style={styles.checkboxDescription}>
                    Perangkat akan menggunakan topic default dari tipe ini
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {!formData.editUseDefault && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Custom Topics</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.editTopic}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, editTopic: text }))}
                  placeholder="topic/1, topic/2, topic/3"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                />
                <Text style={styles.inputHint}>
                  Pisahkan dengan koma untuk multiple topics
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={() => handleApiAction({ 
                action: 'update_device', 
                device_type: formData.targetType, 
                index: formData.targetIndex,
                new_dev_id: formData.editDevId,
                use_default: formData.editUseDefault,
                topic: formData.editTopic
              })}
            >
              <Save size={20} color="white" />
              <Text style={styles.updateBtnText}>Simpan Perubahan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteDeviceBtn}
              onPress={handleDeleteDevice}
            >
              <Trash2 size={18} color="#e11d48" />
              <Text style={styles.deleteDeviceBtnText}>Hapus Device Ini Permanen</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Toast Styles
  toast: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 12,
    color: '#475569',
  },
  toastClose: {
    padding: 4,
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addTypeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
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
  // Stats Card
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    margin: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },
  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // Device Type Card
  typeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
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
    alignItems: 'center',
    marginBottom: 16,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f5f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  deviceCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deviceCountText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  deleteTypeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  cardActions: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  defaultTopicBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  manageDevicesBtn: {
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    justifyContent: 'space-between',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  deviceCountBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  deviceCountBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  // Device Card
  deviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f5f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  defaultBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  customBadge: {
    backgroundColor: '#ffedd5',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  modeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  editDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f7ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  topicsContainer: {
    marginTop: 8,
  },
  topicsLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  topicsScroll: {
    flexGrow: 0,
  },
  topicChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  topicText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f5f7ff',
    justifyContent: 'center',
    alignItems: 'center',
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
  modalCloseBtn: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  // Input Styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
  },
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  saveBtn: {
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
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Device List Modal
  deviceListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceListCount: {
    fontSize: 14,
    color: '#64748b',
  },
  deviceListCountHighlight: {
    fontWeight: 'bold',
    color: '#6366f1',
  },
  addDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addDeviceBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  deviceList: {
    flex: 1,
  },
  emptyDeviceList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  emptyDeviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  emptyDeviceText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  // Checkbox
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#f5f7ff',
    borderColor: '#6366f1',
  },
  checkboxLabel: {
    flex: 1,
  },
  checkboxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  // Update Button
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    marginTop: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Delete Device Button
  deleteDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fee2e2',
    marginTop: 12,
  },
  deleteDeviceBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e11d48',
  },
});