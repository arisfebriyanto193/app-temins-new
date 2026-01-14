import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  RotateCw,
  Package,
  Hash,
  FileText,
  BarChart3,
  Ruler,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Battery,
  Cloud,
  Wifi,
  Server,
  Database,
  Eye,
  EyeOff,
  Filter,
  Search,
  ChevronRight,
  Layers,
  Copy,
  Check,
  AlertCircle,
  Info,
  Key,
  Settings,
  HardDrive,
} from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// === TYPES ===
interface Param {
  label: string;
  key: string;
  unit: string;
  data: string;
}

interface Template {
  id: string;
  code: string;
  name: string;
  params: Param[];
}

// Default state untuk param baru
const defaultParam: Param = { label: '', key: '', unit: '', data: '' };

export default function TemplatesPage() {
  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // State Form Create
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    params: [{ ...defaultParam }]
  });

  // State Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    code: string;
    params: Param[];
  }>({ id: '', name: '', code: '', params: [] });

  // State untuk loading operations
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // API Config
  const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
  const API_URL = `${BASE_URL}/api-app/admin/dev.php`;

  // --- FETCH DATA ---
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status) {
        setTemplates(res.data.data);
        setFilteredTemplates(res.data.data);
      } else {
        Alert.alert('Error', 'Gagal memuat template');
      }
    } catch (error) {
      console.error('Fetch templates error:', error);
      Alert.alert('Error', 'Gagal terhubung ke server');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTemplates();
  }, []);

  // Filter templates berdasarkan search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTemplates(templates);
    } else {
      const filtered = templates.filter(tpl =>
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTemplates(filtered);
    }
  }, [searchQuery, templates]);

  // --- HANDLERS CREATE ---
  const handleAddParamCreate = () => {
    setCreateForm({
      ...createForm,
      params: [...createForm.params, { ...defaultParam }]
    });
  };

  const handleRemoveParamCreate = (index: number) => {
    const newParams = [...createForm.params];
    if (newParams.length > 1) {
      newParams.splice(index, 1);
      setCreateForm({ ...createForm, params: newParams });
    } else {
      Alert.alert('Peringatan', 'Minimal harus ada 1 parameter');
    }
  };

  const handleChangeParamCreate = (index: number, field: keyof Param, value: string) => {
    const newParams = [...createForm.params];
    newParams[index] = { ...newParams[index], [field]: value };
    setCreateForm({ ...createForm, params: newParams });
  };

  const submitCreate = async () => {
    // Validasi
    if (!createForm.name.trim()) {
      Alert.alert('Error', 'Nama template harus diisi');
      return;
    }
    if (!createForm.code.trim()) {
      Alert.alert('Error', 'Kode template harus diisi');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.post(
        `${API_URL}?action=create`,
        createForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.status) {
        Alert.alert('Sukses', 'Template berhasil dibuat');
        setCreateForm({ name: '', code: '', params: [{ ...defaultParam }] });
        fetchTemplates();
      } else {
        Alert.alert('Error', res.data.message || 'Gagal membuat template');
      }
    } catch (error) {
      console.error('Create template error:', error);
      Alert.alert('Error', 'Gagal membuat template');
    } finally {
      setSaving(false);
    }
  };

  // --- HANDLERS EDIT ---
  const openEditModal = (tpl: Template) => {
    const clonedParams = tpl.params.length > 0
      ? tpl.params.map(p => ({ ...p }))
      : [{ ...defaultParam }];
    setEditForm({
      id: tpl.id,
      name: tpl.name,
      code: tpl.code,
      params: clonedParams
    });
    setIsEditModalOpen(true);
  };

  const handleAddParamEdit = () => {
    setEditForm({
      ...editForm,
      params: [...editForm.params, { ...defaultParam }]
    });
  };

  const handleRemoveParamEdit = (index: number) => {
    const newParams = [...editForm.params];
    if (newParams.length > 1) {
      newParams.splice(index, 1);
      setEditForm({ ...editForm, params: newParams });
    } else {
      Alert.alert('Peringatan', 'Minimal harus ada 1 parameter');
    }
  };

  const handleChangeParamEdit = (index: number, field: keyof Param, value: string) => {
    const newParams = [...editForm.params];
    newParams[index] = { ...newParams[index], [field]: value };
    setEditForm({ ...editForm, params: newParams });
  };

  const submitEdit = async () => {
    // Validasi
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Nama template harus diisi');
      return;
    }
    if (!editForm.code.trim()) {
      Alert.alert('Error', 'Kode template harus diisi');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const res = await axios.post(
        `${API_URL}?action=update`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.status) {
        Alert.alert('Sukses', 'Template berhasil diperbarui');
        setIsEditModalOpen(false);
        fetchTemplates();
      } else {
        Alert.alert('Error', res.data.message || 'Gagal memperbarui template');
      }
    } catch (error) {
      console.error('Update template error:', error);
      Alert.alert('Error', 'Gagal memperbarui template');
    } finally {
      setSaving(false);
    }
  };

  // --- HANDLER DELETE ---
  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Hapus Template',
      `Hapus template "${name}"? Semua alat dengan template ini mungkin terpengaruh.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              const token = await AsyncStorage.getItem('user_token');
              const res = await axios.post(
                `${API_URL}?action=delete`,
                { id },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (res.data.status) {
                Alert.alert('Sukses', 'Template berhasil dihapus');
                fetchTemplates();
              } else {
                Alert.alert('Error', res.data.message || 'Gagal menghapus template');
              }
            } catch (error) {
              console.error('Delete template error:', error);
              Alert.alert('Error', 'Gagal menghapus template');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  // --- UI COMPONENTS ---
  const TemplateCard = ({ template }: { template: Template }) => (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateIcon}>
          <Package size={20} color="#6366f1" />
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <View style={styles.codeContainer}>
            <Hash size={12} color="#94a3b8" />
            <Text style={styles.templateCode}>{template.code}</Text>
          </View>
        </View>
        <View style={styles.paramCountBadge}>
          <Text style={styles.paramCountText}>{template.params.length}</Text>
          <Text style={styles.paramCountLabel}>Param</Text>
        </View>
      </View>

      <View style={styles.templateContent}>
        <View style={styles.paramsPreview}>
          {template.params.slice(0, 3).map((param, idx) => (
            <View key={idx} style={styles.paramChip}>
              <Text style={styles.paramChipText}>
                {param.label || `Param ${idx + 1}`}
              </Text>
            </View>
          ))}
          {template.params.length > 3 && (
            <View style={styles.moreChip}>
              <Text style={styles.moreChipText}>+{template.params.length - 3}</Text>
            </View>
          )}
        </View>

        <View style={styles.templateActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => openEditModal(template)}
          >
            <Edit size={18} color="#4f46e5" />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(template.id, template.name)}
            disabled={deletingId === template.id}
          >
            {deletingId === template.id ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <>
                <Trash2 size={18} color="#e11d48" />
                <Text style={styles.actionBtnText}>Hapus</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const ParameterInputRow = ({
    param,
    index,
    onRemove,
    onChange,
    showRemove = true,
    mode = 'create'
  }: {
    param: Param;
    index: number;
    onRemove: (index: number) => void;
    onChange: (index: number, field: keyof Param, value: string) => void;
    showRemove?: boolean;
    mode: 'create' | 'edit';
  }) => (
    <View style={styles.paramRow}>
      <View style={styles.paramRowHeader}>
        <Text style={styles.paramIndex}>Parameter {index + 1}</Text>
        {showRemove && (
          <TouchableOpacity
            onPress={() => onRemove(index)}
            style={styles.removeParamBtn}
          >
            <Trash2 size={18} color="#e11d48" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.paramInputs}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Label *</Text>
          <TextInput
            style={styles.input}
            value={param.label}
            onChangeText={(text) => onChange(index, 'label', text)}
            placeholder="Contoh: Suhu"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Key *</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            value={param.key}
            onChangeText={(text) => onChange(index, 'key', text)}
            placeholder="sensor_key"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Unit</Text>
          <TextInput
            style={[styles.input, styles.centerInput]}
            value={param.unit}
            onChangeText={(text) => onChange(index, 'unit', text)}
            placeholder="°C"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Chart Key</Text>
          <TextInput
            style={[styles.input, styles.centerInput]}
            value={param.data}
            onChangeText={(text) => onChange(index, 'data', text)}
            placeholder="data"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Template Management</Text>
          <Text style={styles.headerSubtitle}>Kelola template alat IoT Anda</Text>
        </View>
        <TouchableOpacity onPress={fetchTemplates} style={styles.refreshBtn}>
          <RotateCw size={22} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari template..."
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
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsContent}>
            <View style={styles.statsIcon}>
              <Layers size={24} color="#6366f1" />
            </View>
            <View>
              <Text style={styles.statsValue}>{templates.length}</Text>
              <Text style={styles.statsLabel}>Total Template</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsContent}>
            <View style={[styles.statsIcon, { backgroundColor: '#10b98115' }]}>
              <FileText size={24} color="#10b981" />
            </View>
            <View>
              <Text style={[styles.statsValue, { color: '#10b981' }]}>
                {templates.reduce((acc, tpl) => acc + tpl.params.length, 0)}
              </Text>
              <Text style={styles.statsLabel}>Total Parameter</Text>
            </View>
          </View>
        </View>

        {/* Create Form Section */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Buat Template Baru</Text>
            <Text style={styles.sectionSubtitle}>
              Tambahkan template perangkat baru
            </Text>
          </View>

          <View style={styles.formCard}>
            {/* Nama Template */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Template *</Text>
              <TextInput
                style={styles.input}
                value={createForm.name}
                onChangeText={(text) => setCreateForm({ ...createForm, name: text })}
                placeholder="Contoh: Smart Farming v2"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Kode Template */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kode Unik *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={createForm.code}
                onChangeText={(text) => setCreateForm({ ...createForm, code: text })}
                placeholder="smart_farm_v2"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              <Text style={styles.inputHint}>
                Gunakan underscore (_) tanpa spasi
              </Text>
            </View>

            {/* Parameters Section */}
            <View style={styles.paramsSection}>
              <View style={styles.paramsHeader}>
                <Text style={styles.paramsTitle}>Parameter Default</Text>
                <Text style={styles.paramsSubtitle}>Konfigurasi data sensor</Text>
              </View>

              <TouchableOpacity
                style={styles.addParamBtn}
                onPress={handleAddParamCreate}
              >
                <Plus size={18} color="#6366f1" />
                <Text style={styles.addParamText}>Tambah Parameter</Text>
              </TouchableOpacity>

              <ScrollView
                style={styles.paramsList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {createForm.params.map((param, idx) => (
                  <ParameterInputRow
                    key={idx}
                    param={param}
                    index={idx}
                    onRemove={handleRemoveParamCreate}
                    onChange={handleChangeParamCreate}
                    mode="create"
                  />
                ))}
              </ScrollView>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={submitCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Save size={20} color="white" />
                  <Text style={styles.submitBtnText}>Simpan Template Baru</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Templates List Section */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daftar Template</Text>
            <Text style={styles.sectionSubtitle}>
              Template yang tersedia untuk perangkat
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Memuat template...</Text>
            </View>
          ) : filteredTemplates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Template tidak ditemukan' : 'Belum ada template'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Coba dengan kata kunci lain'
                  : 'Buat template pertama Anda'}
              </Text>
            </View>
          ) : (
            filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Template</Text>
              <Text style={styles.modalSubtitle}>Ubah konfigurasi template</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditModalOpen(false)}
              style={styles.closeBtn}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Nama Template */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Template *</Text>
              <TextInput
                style={styles.input}
                value={editForm.name}
                onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Kode Template */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kode Unik *</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={editForm.code}
                onChangeText={(text) => setEditForm({ ...editForm, code: text })}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>

            {/* Parameters Section */}
            <View style={styles.paramsSection}>
              <View style={styles.paramsHeader}>
                <Text style={styles.paramsTitle}>Parameter</Text>
                <Text style={styles.paramsSubtitle}>Konfigurasi data sensor</Text>
              </View>

              <TouchableOpacity
                style={styles.addParamBtn}
                onPress={handleAddParamEdit}
              >
                <Plus size={18} color="#6366f1" />
                <Text style={styles.addParamText}>Tambah Parameter</Text>
              </TouchableOpacity>

              <ScrollView
                style={styles.paramsList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {editForm.params.map((param, idx) => (
                  <ParameterInputRow
                    key={idx}
                    param={param}
                    index={idx}
                    onRemove={handleRemoveParamEdit}
                    onChange={handleChangeParamEdit}
                    mode="edit"
                  />
                ))}
              </ScrollView>
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsEditModalOpen(false)}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={submitEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Save size={20} color="white" />
                  <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  refreshBtn: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
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
  scrollContent: {
    padding: 20,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsContent: {
    alignItems: 'center',
  },
  statsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f115',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
    textAlign: 'center',
  },
  statsLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },
  formSection: {
    marginBottom: 24,
  },
  listSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
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
  centerInput: {
    textAlign: 'center',
  },
  inputHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  paramsSection: {
    marginTop: 8,
  },
  paramsHeader: {
    marginBottom: 16,
  },
  paramsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  paramsSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  addParamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 12,
    marginBottom: 16,
  },
  addParamText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  paramsList: {
    maxHeight: 300,
  },
  paramRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  paramRowHeader: {
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
  removeParamBtn: {
    padding: 4,
  },
  paramInputs: {
    gap: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  templateCard: {
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
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f5f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  templateCode: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  paramCountBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  paramCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
  },
  paramCountLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  templateContent: {},
  paramsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paramChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paramChipText: {
    fontSize: 12,
    color: '#475569',
  },
  moreChip: {
    backgroundColor: '#f5f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  moreChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editBtn: {
    borderColor: '#e0e7ff',
    backgroundColor: '#f5f7ff',
  },
  deleteBtn: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
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
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
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
});