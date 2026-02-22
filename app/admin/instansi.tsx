import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Modal, TextInput,
  FlatList, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api-app/admin/instansi.php`;

export default function InstansiPage() {
  const [instansi, setInstansi] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedInst, setSelectedInst] = useState<number | null>(null);
  const [selectedInstName, setSelectedInstName] = useState('');
  const [details, setDetails] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editData, setEditData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Assign user modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Detail panel
  const [showDetail, setShowDetail] = useState(false);

  // Switch akun instansi
  const [switchLoading, setSwitchLoading] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([loadInstansi(), loadAllUsers()]);
    setLoading(false);
    setRefreshing(false);
  };

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('user_token');
    return { Authorization: `Bearer ${token}` };
  };

  const loadInstansi = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE}?action=get_instansi`, { headers });
      setInstansi(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to load instansi', e);
      setInstansi([]);
    }
  };

  const loadAllUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE}?action=get_all_users`, { headers });
      setAllUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setAllUsers([]);
    }
  };

  const loadDetails = async (id: number, name: string) => {
    setDetailsLoading(true);
    setShowDetail(true);
    setSelectedInst(id);
    setSelectedInstName(name);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE}?action=get_users_by_instansi&instansi_id=${id}`, { headers });
      setDetails(res.data);
    } catch (e) {
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const assignUser = async () => {
    if (!selectedUserId) {
      Alert.alert('Info', 'Pilih user terlebih dahulu!');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      await axios.post(`${API_BASE}?action=assign_user`, {
        instansi_id: selectedInst,
        user_id: selectedUserId
      }, { headers });
      setSelectedUserId('');
      setAssignModalVisible(false);
      await loadDetails(selectedInst!, selectedInstName);
      await loadAllUsers();
    } catch (e) {
      Alert.alert('Error', 'Gagal menghubungkan user');
    }
  };

  const removeUser = (id: number) => {
    Alert.alert('Konfirmasi', 'Lepas user dari instansi ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Lepas', style: 'destructive',
        onPress: async () => {
          const headers = await getAuthHeaders();
          await axios.get(`${API_BASE}?action=remove_user_from_instansi&id=${id}`, { headers });
          await loadDetails(selectedInst!, selectedInstName);
          await loadAllUsers();
        }
      }
    ]);
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditData(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setModalVisible(true);
  };

  const openEditModal = (item: any) => {
    setModalMode('edit');
    setEditData(item);
    setFormName(item.name || '');
    setFormUsername(item.username || '');
    setFormPassword('');
    setModalVisible(true);
  };

  const deleteInstansi = (id: number, name: string) => {
    Alert.alert('Hapus Instansi', `Hapus "${name}"? Data user terkait akan terlepas.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          const headers = await getAuthHeaders();
          await axios.get(`${API_BASE}?action=delete_instansi&id=${id}`, { headers });
          await loadInstansi();
          if (selectedInst === id) {
            setSelectedInst(null);
            setDetails(null);
            setShowDetail(false);
          }
        }
      }
    ]);
  };

  // Switch ke dashboard instansi (generate token lalu navigate)
  const switchInstansi = async (id: number, name: string) => {
    setSwitchLoading(id);
    try {
      const url = `${API_BASE}?action=get_instansi_token&instansi_id=${id}`;
      const headers = await getAuthHeaders();
      const res = await axios.get(url, { headers });
      const data = res.data;
      console.log(url);
      if (data.status && data.token) {
        await AsyncStorage.multiSet([
          ['instansi_token', data.token],
          ['instansi_id', String(id)],
          ['instansi_name', name],
        ]);
        Alert.alert(
          'Akun Berhasil Dipilih ✓',
          `Dashboard: ${name}`,
          [{ text: 'Buka', onPress: () => router.push('/instansi') }, { text: 'Nanti' }]
        );
      } else {
        Alert.alert('Error', data.message || 'Gagal mendapatkan token');
      }
    } catch {
      Alert.alert('Error', 'Gagal switch akun instansi');
    } finally {
      setSwitchLoading(null);
    }
  };

  const handleModalSubmit = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Nama instansi tidak boleh kosong');
      return;
    }
    setModalLoading(true);
    try {
      const headers = await getAuthHeaders();
      const url = modalMode === 'add'
        ? `${API_BASE}?action=add_instansi`
        : `${API_BASE}?action=update_instansi`;
      const payload = modalMode === 'add'
        ? { name: formName, username: formUsername, password: formPassword }
        : { id: editData.id, name: formName, username: formUsername, password: formPassword };

      await axios.post(url, payload, { headers });
      setModalVisible(false);
      await loadInstansi();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan data');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredInstansi = useMemo(() => {
    return instansi.filter(i =>
      (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [instansi, searchTerm]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u =>
      (u.username || '').toLowerCase().includes(userSearchTerm.toLowerCase())
    );
  }, [allUsers, userSearchTerm]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Memuat data instansi...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Manajemen Instansi</Text>
          <Text style={styles.headerSubtitle}>Kelola data instansi dan perangkat terdaftar</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari instansi..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#94a3b8"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* CONTENT */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
      >
        {/* INSTANSI LIST */}
        <Text style={styles.sectionLabel}>Daftar Instansi ({filteredInstansi.length})</Text>

        {filteredInstansi.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Tidak ada instansi</Text>
            <Text style={styles.emptyText}>Tap tombol + untuk menambah instansi baru</Text>
          </View>
        ) : (
          filteredInstansi.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.instansiCard, selectedInst === item.id && styles.instansiCardActive]}
              onPress={() => loadDetails(item.id, item.name)}
            >
              <View style={styles.instansiCardLeft}>
                <View style={[styles.instansiAvatar, selectedInst === item.id && styles.instansiAvatarActive]}>
                  <Text style={[styles.instansiAvatarText, selectedInst === item.id && styles.instansiAvatarTextActive]}>
                    {(item.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.instansiName, selectedInst === item.id && styles.instansiNameActive]}>
                    {item.name}
                  </Text>
                  <Text style={styles.instansiUsername}>@{item.username}</Text>
                </View>
              </View>
              <View style={styles.instansiCardActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
                  <Ionicons name="pencil" size={16} color="#f59e0b" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteInstansi(item.id, item.name)}>
                  <Ionicons name="trash" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* DETAIL PANEL */}
        {showDetail && selectedInst && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {selectedInstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.detailTitle}>{selectedInstName}</Text>
                  <Text style={styles.detailSubtitle}>ID: {selectedInst}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => setAssignModalVisible(true)}
                >
                  <Ionicons name="person-add" size={16} color="white" />
                  <Text style={styles.assignBtnText}>Tambah</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.assignBtn, { backgroundColor: '#3b82f6' }]}
                  onPress={() => switchInstansi(selectedInst!, selectedInstName)}
                  disabled={switchLoading === selectedInst}
                >
                  {switchLoading === selectedInst
                    ? <ActivityIndicator size="small" color="white" />
                    : <>
                        <Ionicons name="swap-horizontal-outline" size={16} color="white" />
                        <Text style={styles.assignBtnText}>Dashboard</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {detailsLoading ? (
              <ActivityIndicator style={{ padding: 20 }} color="#6366f1" />
            ) : (
              <>
                <Text style={styles.memberLabel}>
                  Anggota Terhubung ({details?.devices?.length || 0})
                </Text>
                {details?.devices?.length > 0 ? (
                  details.devices.map((d: any) => (
                    <View key={d.id} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <Ionicons name="hardware-chip-outline" size={18} color="#6366f1" />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.memberDeviceId}>{d.device_unique_id}</Text>
                          <Text style={styles.memberLocation}>{d.location || '-'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeUser(d.id)} style={styles.removeBtn}>
                        <Ionicons name="unlink" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.memberEmpty}>
                    <Ionicons name="people-outline" size={32} color="#cbd5e1" />
                    <Text style={styles.memberEmptyText}>Belum ada anggota</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ADD/EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Tambah Instansi Baru' : 'Edit Instansi'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Nama Instansi *</Text>
            <TextInput
              style={styles.formInput}
              value={formName}
              onChangeText={setFormName}
              placeholder="Nama instansi"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.formLabel}>Username Login</Text>
            <TextInput
              style={styles.formInput}
              value={formUsername}
              onChangeText={setFormUsername}
              placeholder="Username untuk login"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>Password {modalMode === 'edit' ? '(kosongkan jika tidak diubah)' : '*'}</Text>
            <TextInput
              style={styles.formInput}
              value={formPassword}
              onChangeText={setFormPassword}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={modalLoading}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleModalSubmit}
                disabled={modalLoading}
              >
                {modalLoading
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.saveBtnText}>Simpan</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ASSIGN USER MODAL */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Anggota ke {selectedInstName}</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.formInput}
              value={userSearchTerm}
              onChangeText={setUserSearchTerm}
              placeholder="Cari device/user..."
              placeholderTextColor="#94a3b8"
            />

            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userSelectRow,
                    selectedUserId === String(item.id) && styles.userSelectRowActive
                  ]}
                  onPress={() => setSelectedUserId(String(item.id))}
                >
                  <Ionicons
                    name="hardware-chip-outline"
                    size={18}
                    color={selectedUserId === String(item.id) ? '#6366f1' : '#94a3b8'}
                  />
                  <Text style={[
                    styles.userSelectText,
                    selectedUserId === String(item.id) && styles.userSelectTextActive
                  ]}>
                    {item.username}
                  </Text>
                  {selectedUserId === String(item.id) && (
                    <Ionicons name="checkmark-circle" size={18} color="#6366f1" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.memberEmptyText}>Tidak ada user tersedia</Text>
              }
            />

            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 16, opacity: selectedUserId ? 1 : 0.5 }]}
              onPress={assignUser}
              disabled={!selectedUserId}
            >
              <Ionicons name="link" size={18} color="white" />
              <Text style={styles.saveBtnText}>Hubungkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748b' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 16 },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  addBtn: {
    backgroundColor: '#6366f1', width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1e293b' },

  content: { padding: 16 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  instansiCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e2e8f0',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  instansiCardActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  instansiCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  instansiAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  instansiAvatarActive: { backgroundColor: '#6366f1' },
  instansiAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#64748b' },
  instansiAvatarTextActive: { color: 'white' },
  instansiName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  instansiNameActive: { color: '#4338ca' },
  instansiUsername: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  instansiCardActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#fef3c7',
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center',
  },

  detailPanel: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  detailAvatar: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#6366f1',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  detailAvatarText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  detailTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  detailSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8,
  },
  assignBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },

  memberLabel: {
    fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberDeviceId: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  memberLocation: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  memberEmpty: { alignItems: 'center', paddingVertical: 24 },
  memberEmptyText: { fontSize: 13, color: '#94a3b8', marginTop: 8 },
  removeBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: '#fee2e2',
    justifyContent: 'center', alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 14 },
  formInput: {
    backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#6366f1',
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  saveBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  userSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  userSelectRowActive: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 8 },
  userSelectText: { flex: 1, fontSize: 14, color: '#64748b' },
  userSelectTextActive: { color: '#4338ca', fontWeight: '600' },
});
