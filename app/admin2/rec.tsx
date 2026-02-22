import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, ActivityIndicator, Modal, Alert, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api-app/admin/set_rec.php`;

interface Device { dev_id: string; use_default: boolean; topic: string[]; }
interface DeviceTypeConfig { def_topic: string[]; devices: Device[]; }
interface RootData { device_type: Record<string, DeviceTypeConfig>; }

export default function RecPage() {
  const [data, setData] = useState<RootData>({ device_type: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal state
  const [modal, setModal] = useState<'none' | 'addType' | 'defTopic' | 'deviceList' | 'addDevice' | 'editDevice'>('none');
  const [targetType, setTargetType] = useState('');
  const [inputType, setInputType] = useState('');
  const [inputDefTopic, setInputDefTopic] = useState('');
  const [inputDevId, setInputDevId] = useState('');
  const [targetIndex, setTargetIndex] = useState(-1);
  const [editDevId, setEditDevId] = useState('');
  const [editUseDefault, setEditUseDefault] = useState(false);
  const [editTopic, setEditTopic] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(API_URL);
      if (res.data.status && res.data.data) {
        setData(Array.isArray(res.data.data.device_type) ? { device_type: {} } : res.data.data);
      }
    } catch (e) { console.error('Fetch failed', e); }
    finally { setIsLoading(false); }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const closeModal = () => {
    setModal('none');
    setInputType(''); setInputDefTopic(''); setInputDevId('');
  };

  const handleApi = async (payload: any) => {
    try {
      const res = await axios.post(API_URL, payload);
      if (res.data.status) { showToast(res.data.message, 'success'); fetchData(); closeModal(); }
      else showToast(res.data.message, 'error');
    } catch (e) { showToast('Terjadi kesalahan jaringan', 'error'); }
  };

  const openDefTopic = (type: string, topics: string[]) => {
    setTargetType(type); setInputDefTopic(topics.join(', ')); setModal('defTopic');
  };

  const openDeviceList = (type: string) => { setTargetType(type); setModal('deviceList'); };

  const openEditDevice = (i: number, dev: Device) => {
    setTargetIndex(i); setEditDevId(dev.dev_id);
    setEditUseDefault(dev.use_default); setEditTopic(dev.topic.join(', '));
    setModal('editDevice');
  };

  const handleDeleteType = (type: string) => {
    Alert.alert('Hapus Tipe', `Hapus tipe "${type}" beserta semua devicenya?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => handleApi({ action: 'delete_device_type', device_type: type }) }
    ]);
  };

  const handleDeleteDevice = () => {
    Alert.alert('Hapus Device', 'Hapus device ini permanen?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => handleApi({ action: 'delete_device', device_type: targetType, index: targetIndex }) }
    ]);
  };

  const deviceTypes = Object.entries(data.device_type);

  return (
    <SafeAreaView style={styles.container}>
      {/* TOAST */}
      {toast && (
        <View style={[styles.toast, { borderLeftColor: toast.type === 'success' ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.toastIcon}>{toast.type === 'success' ? '✅' : '⚠️'}</Text>
          <Text style={styles.toastText}>{toast.msg}</Text>
          <TouchableOpacity onPress={() => setToast(null)}><Ionicons name="close" size={18} color="#64748b" /></TouchableOpacity>
        </View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rekam Data Config</Text>
          <Text style={styles.headerSubtitle}>Konfigurasi topic MQTT per device type</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setInputType(''); setModal('addType'); }}>
          <Ionicons name="add" size={22} color="white" />
          <Text style={styles.addBtnText}>Tipe Baru</Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Memuat konfigurasi...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {deviceTypes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Belum ada tipe perangkat</Text>
              <Text style={styles.emptyText}>Tap "Tipe Baru" untuk menambahkan konfigurasi</Text>
            </View>
          ) : (
            deviceTypes.map(([type, config]) => (
              <View key={type} style={styles.typeCard}>
                <View style={styles.typeCardHeader}>
                  <View style={styles.typeCardLeft}>
                    <View style={styles.typeIcon}>
                      <Ionicons name="hardware-chip" size={22} color="white" />
                    </View>
                    <View>
                      <Text style={styles.typeName}>{type}</Text>
                      <Text style={styles.typeCount}>{config.devices.length} perangkat</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.deleteTypeBtn} onPress={() => handleDeleteType(type)}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.actionBtn} onPress={() => openDefTopic(type, config.def_topic)}>
                  <View style={styles.actionBtnLeft}>
                    <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                      <Ionicons name="settings" size={16} color="#16a34a" />
                    </View>
                    <Text style={[styles.actionBtnText, { color: '#15803d' }]}>Default Topic</Text>
                  </View>
                  <Text style={styles.actionBtnBadge}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { borderColor: '#c7d2fe' }]} onPress={() => openDeviceList(type)}>
                  <View style={styles.actionBtnLeft}>
                    <View style={[styles.actionIcon, { backgroundColor: '#eef2ff' }]}>
                      <Ionicons name="list" size={16} color="#4338ca" />
                    </View>
                    <Text style={[styles.actionBtnText, { color: '#4338ca' }]}>Kelola Perangkat</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{config.devices.length}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* === MODALS === */}

      {/* Add Type Modal */}
      <Modal visible={modal === 'addType'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Tambah Tipe Perangkat</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={22} color="#64748b" /></TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Nama Tipe *</Text>
            <TextInput style={styles.input} value={inputType} onChangeText={setInputType} placeholder="Contoh: AWS, AWLR" placeholderTextColor="#94a3b8" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}><Text style={styles.cancelBtnText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleApi({ action: 'add_device_type', device_type: inputType })}>
                <Text style={styles.saveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Default Topic Modal */}
      <Modal visible={modal === 'defTopic'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Default Topics</Text>
                <Text style={styles.modalSubtitle}>{targetType}</Text>
              </View>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={22} color="#64748b" /></TouchableOpacity>
            </View>
            <Text style={styles.infoBanner}>Topik ini otomatis digunakan oleh perangkat dengan mode "Default"</Text>
            <Text style={styles.fieldLabel}>Topics (pisahkan dengan koma)</Text>
            <TextInput style={[styles.input, styles.textarea]} value={inputDefTopic} onChangeText={setInputDefTopic} multiline numberOfLines={4} placeholder="topic/sensor1, topic/sensor2" placeholderTextColor="#94a3b8" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}><Text style={styles.cancelBtnText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleApi({ action: 'update_def_topic', device_type: targetType, def_topic: inputDefTopic })}>
                <Text style={styles.saveBtnText}>Update Default</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Device List Modal */}
      <Modal visible={modal === 'deviceList'} transparent animationType="slide">
        <View style={styles.slideOverlay}>
          <View style={styles.slideBox}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Kelola Perangkat</Text>
                <Text style={styles.modalSubtitle}>{targetType}</Text>
              </View>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={22} color="#64748b" /></TouchableOpacity>
            </View>
            <View style={styles.deviceListHeader}>
              <Text style={styles.deviceListCount}>{data.device_type[targetType]?.devices.length || 0} perangkat</Text>
              <TouchableOpacity style={styles.addDevBtn} onPress={() => { setInputDevId(''); setModal('addDevice'); }}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addDevBtnText}>Tambah Device</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(data.device_type[targetType]?.devices || []).length === 0 ? (
                <View style={styles.center}><Text style={styles.emptyText}>Belum ada perangkat</Text></View>
              ) : (
                data.device_type[targetType].devices.map((dev, i) => (
                  <TouchableOpacity key={i} style={styles.deviceRow} onPress={() => openEditDevice(i, dev)}>
                    <View>
                      <Text style={styles.deviceId}>{dev.dev_id}</Text>
                      <View style={[styles.modeBadge, { backgroundColor: dev.use_default ? '#dcfce7' : '#fef3c7' }]}>
                        <Text style={[styles.modeBadgeText, { color: dev.use_default ? '#16a34a' : '#b45309' }]}>
                          {dev.use_default ? 'Default Mode' : 'Custom Mode'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Device Modal */}
      <Modal visible={modal === 'addDevice'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Tambah Device</Text>
                <Text style={styles.modalSubtitle}>{targetType}</Text>
              </View>
              <TouchableOpacity onPress={() => setModal('deviceList')}><Ionicons name="close" size={22} color="#64748b" /></TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Device ID / Serial *</Text>
            <TextInput style={styles.input} value={inputDevId} onChangeText={setInputDevId} placeholder="e.g. ESP32_Room1" placeholderTextColor="#94a3b8" autoCapitalize="none" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal('deviceList')}><Text style={styles.cancelBtnText}>Kembali</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleApi({ action: 'add_device', device_type: targetType, dev_id: inputDevId })}>
                <Text style={styles.saveBtnText}>Tambah Device</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Device Modal */}
      <Modal visible={modal === 'editDevice'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Edit Device</Text>
              <TouchableOpacity onPress={() => setModal('deviceList')}><Ionicons name="close" size={22} color="#64748b" /></TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Device ID</Text>
            <TextInput style={styles.input} value={editDevId} onChangeText={setEditDevId} placeholderTextColor="#94a3b8" />
            <View style={[styles.switchBox, { marginTop: 12 }]}>
              <View>
                <Text style={styles.switchLabel}>Gunakan Default Topic</Text>
                <Text style={styles.switchSub}>Gunakan topic default dari tipe ini</Text>
              </View>
              <Switch value={editUseDefault} onValueChange={setEditUseDefault} trackColor={{ true: '#6366f1' }} />
            </View>
            <Text style={[styles.fieldLabel, { opacity: editUseDefault ? 0.4 : 1 }]}>Custom Topics</Text>
            <TextInput
              style={[styles.input, styles.textarea, { opacity: editUseDefault ? 0.4 : 1 }]}
              value={editTopic} onChangeText={setEditTopic} multiline numberOfLines={3}
              placeholder="topic/1, topic/2" placeholderTextColor="#94a3b8"
              editable={!editUseDefault}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 12 }]}
              onPress={() => handleApi({ action: 'update_device', device_type: targetType, index: targetIndex, new_dev_id: editDevId, use_default: editUseDefault, topic: editTopic })}
            >
              <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteDevBtn} onPress={handleDeleteDevice}>
              <Ionicons name="trash" size={16} color="#ef4444" />
              <Text style={styles.deleteDevBtnText}>Hapus Device Ini Permanen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748b' },
  toast: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 100, backgroundColor: 'white', borderLeftWidth: 4, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  toastIcon: { fontSize: 18 },
  toastText: { flex: 1, fontSize: 13, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 16 },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  content: { padding: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginTop: 16 },
  emptyText: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  typeCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  typeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  typeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  typeName: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  typeCount: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deleteTypeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, marginTop: 10 },
  actionBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionIcon: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  actionBtnBadge: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  countBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  countBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#4338ca' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: 'white', borderRadius: 16, padding: 20 },
  slideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  slideBox: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  textarea: { height: 90, textAlignVertical: 'top' },
  infoBanner: { backgroundColor: '#eff6ff', color: '#2563eb', fontSize: 12, padding: 10, borderRadius: 8, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#6366f1', alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  deviceListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deviceListCount: { fontSize: 14, color: '#64748b' },
  addDevBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addDevBtnText: { color: 'white', fontWeight: '600', fontSize: 12 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  deviceId: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  modeBadge: { flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },
  switchBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eef2ff', padding: 14, borderRadius: 10 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  switchSub: { fontSize: 12, color: '#6366f1', marginTop: 2 },
  deleteDevBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 12, marginTop: 12 },
  deleteDevBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
});
