import { Picker } from '@react-native-picker/picker';
import {
  ChevronDown,
  Plus,
  Ruler,
  Save,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

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

interface AutomationRule {
  id?: string;
  parameter_name: string;
  operator: string;
  threshold: string | number;
  send_email: boolean;
  send_notification: boolean;
}

interface EditDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  loading: boolean;
  selectedUser: any;
  formData: any;
  setFormData: (d: any) => void;
  paramsList: SensorParam[];
  setParamsList: (p: SensorParam[]) => void;
  handleDeleteParam: (index: number) => void;
  automationsList: AutomationRule[];
  setAutomationsList: (a: AutomationRule[]) => void;
}

type TabType = 'alat' | 'akun' | 'sensor' | 'otomasi';

export default function EditDeviceModal({
  visible,
  onClose,
  onSave,
  loading,
  selectedUser,
  formData,
  setFormData,
  paramsList,
  setParamsList,
  handleDeleteParam,
  automationsList,
  setAutomationsList,
}: EditDeviceModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('alat');

  const tabs: { key: TabType; label: string }[] = [
    { key: 'alat', label: 'Alat' },
    { key: 'akun', label: 'Akun' },
    { key: 'sensor', label: 'Sensor' },
    { key: 'otomasi', label: 'Otomasi' },
  ];

  const addAutomation = () => {
    const defaultParam = paramsList[0]?.chart_data || paramsList[0]?.label || '';
    setAutomationsList([
      ...automationsList,
      {
        parameter_name: defaultParam,
        operator: '>',
        threshold: 0,
        send_email: false,
        send_notification: true,
      },
    ]);
  };

  const updateAutomation = (idx: number, key: string, value: any) => {
    const updated = [...automationsList];
    (updated[idx] as any)[key] = value;
    setAutomationsList(updated);
  };

  const removeAutomation = (idx: number) => {
    const updated = [...automationsList];
    updated.splice(idx, 1);
    setAutomationsList(updated);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Edit Konfigurasi</Text>
            <Text style={s.subtitle}>{selectedUser?.username}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <X size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={s.tabBar}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabItem, activeTab === t.key && s.tabItemActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={s.form} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ==================== TAB: KONFIGURASI ALAT ==================== */}
          {activeTab === 'alat' && (
            <View>

              {/* AWLR Config */}
              {selectedUser?.device_type === 'AWLR' && (
                <View style={s.awlrCard}>
                  <View style={s.awlrRow}>
                    <Ruler size={22} color="#0ea5e9" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.awlrTitle}>Konfigurasi AWLR</Text>
                      <Text style={s.awlrSub}>Pengaturan sensor ketinggian air</Text>
                    </View>
                  </View>
                  <Text style={s.awlrAlert}>
                    ⚠ UNTUK GRAFIK DASHBOARD: isikan Chart Order = 111
                  </Text>

                  {/* Mode switcher */}
                  <View style={s.modeSwitcher}>
                    {['template', 'custom'].map(mode => (
                      <TouchableOpacity
                        key={mode}
                        style={[s.modeBtn, (formData.awlr_mode || 'template') === mode && s.modeBtnActive]}
                        onPress={() => setFormData({ ...formData, awlr_mode: mode })}
                      >
                        <Text style={[s.modeBtnText, (formData.awlr_mode || 'template') === mode && s.modeBtnTextActive]}>
                          {mode === 'template' ? 'Template' : 'Custom'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(!formData.awlr_mode || formData.awlr_mode === 'template') ? (
                    <>
                      <Text style={s.label}>Tinggi Sensor (cm)</Text>
                      <TextInput
                        style={s.input}
                        value={formData.awlr_height}
                        onChangeText={t => setFormData({ ...formData, awlr_height: t })}
                        placeholder="0"
                        keyboardType="numeric"
                      />

                      <Text style={s.label}>Jenis AWLR</Text>
                      <View style={s.picker}>
                        <Picker selectedValue={formData.awlrJenis} onValueChange={v => setFormData({ ...formData, awlrJenis: v })}>
                          <Picker.Item label="Sungai" value="sungai" />
                          <Picker.Item label="Sumur" value="sumur" />
                        </Picker>
                      </View>

                      <Text style={s.label}>Data Sensor AWLR</Text>
                      <View style={s.picker}>
                        <Picker selectedValue={formData.awlrData} onValueChange={v => setFormData({ ...formData, awlrData: v })}>
                          <Picker.Item label="-- Pilih Sensor --" value="" />
                          {paramsList.map((p, i) => (
                            <Picker.Item key={i} label={`${p.label} (${p.chart_data})`} value={p.chart_data} />
                          ))}
                        </Picker>
                      </View>

                      <Text style={s.label}>Pengurangan Data</Text>
                      <View style={s.picker}>
                        <Picker selectedValue={formData.awlrStatusData} onValueChange={v => setFormData({ ...formData, awlrStatusData: v })}>
                          <Picker.Item label="Aktif" value="1" />
                          <Picker.Item label="Tidak Aktif" value="0" />
                        </Picker>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={s.label}>Rumus Custom</Text>
                      <TextInput
                        style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                        value={formData.awlr_custom_formula || ''}
                        onChangeText={t => setFormData({ ...formData, awlr_custom_formula: t })}
                        placeholder="Contoh: (data * 10) + 5"
                        multiline
                      />
                      <Text style={s.hint}>Gunakan format matematika. Variabel: data = nilai sensor.</Text>
                      <View style={s.opRow}>
                        {['*', '/', '+', '-'].map(op => (
                          <TouchableOpacity
                            key={op}
                            style={s.opBtn}
                            onPress={() => setFormData({ ...formData, awlr_custom_formula: (formData.awlr_custom_formula || '') + ` ${op} ` })}
                          >
                            <Text style={s.opBtnText}>{op}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Konfigurasi Umum */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Pengaturan Umum</Text>

                <Text style={s.label}>Zona Waktu</Text>
                <View style={s.picker}>
                  <Picker selectedValue={formData.timezone} onValueChange={v => setFormData({ ...formData, timezone: v })}>
                    <Picker.Item label="WIB" value="WIB" />
                    <Picker.Item label="WITA" value="WITA" />
                    <Picker.Item label="WIT" value="WIT" />
                  </Picker>
                </View>

                <Text style={s.label}>Status Alat</Text>
                <View style={s.picker}>
                  <Picker selectedValue={formData.statusAlat} onValueChange={v => setFormData({ ...formData, statusAlat: v })}>
                    <Picker.Item label="Aktif" value="1" />
                    <Picker.Item label="Tidak Aktif" value="0" />
                  </Picker>
                </View>
              </View>
            </View>
          )}

          {/* ==================== TAB: KONFIGURASI AKUN ==================== */}
          {activeTab === 'akun' && (
            <View>
              {/* Informasi Akun */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Informasi Akun</Text>

                <Text style={s.label}>Username</Text>
                <TextInput
                  style={s.input}
                  value={formData.username || ''}
                  onChangeText={t => setFormData({ ...formData, username: t })}
                  placeholder="username_perangkat"
                  autoCapitalize="none"
                />

                <Text style={s.label}>Email</Text>
                <TextInput
                  style={s.input}
                  value={formData.email || ''}
                  onChangeText={t => setFormData({ ...formData, email: t })}
                  placeholder="contoh@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={s.label}>Masa Aktif Kartu (SIM)</Text>
                <TextInput
                  style={s.input}
                  value={formData.masa_aktif || ''}
                  onChangeText={t => setFormData({ ...formData, masa_aktif: t })}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={s.label}>Masa Aktif Paket Internet</Text>
                <TextInput
                  style={s.input}
                  value={formData.masa_paket || ''}
                  onChangeText={t => setFormData({ ...formData, masa_paket: t })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              {/* Lokasi & Kontak */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Lokasi &amp; Kontak</Text>

                <Text style={s.label}>Owner / Instansi (Pemilik)</Text>
                <TextInput
                  style={s.input}
                  value={formData.owner || ''}
                  onChangeText={t => setFormData({ ...formData, owner: t })}
                  placeholder="Nama pemilik/instansi"
                />

                <Text style={s.label}>Kota / Kabupaten</Text>
                <TextInput
                  style={s.input}
                  value={formData.city || ''}
                  onChangeText={t => setFormData({ ...formData, city: t })}
                  placeholder="Contoh: Jakarta"
                />

                <Text style={s.label}>Lokasi Detail</Text>
                <TextInput
                  style={s.input}
                  value={formData.lokasi || ''}
                  onChangeText={t => setFormData({ ...formData, lokasi: t })}
                  placeholder="Contoh: Sungai Ciliwung, Jkt"
                />

                <Text style={s.label}>No. IoT SIM</Text>
                <TextInput
                  style={s.input}
                  value={formData.internet_no || ''}
                  onChangeText={t => setFormData({ ...formData, internet_no: t })}
                  placeholder="Nomor SIM kartu IoT"
                  keyboardType="phone-pad"
                />

                <Text style={s.label}>Nama PIC</Text>
                <TextInput
                  style={s.input}
                  value={formData.pic_name || ''}
                  onChangeText={t => setFormData({ ...formData, pic_name: t })}
                  placeholder="Nama Penanggung Jawab"
                />

                <Text style={s.label}>Kontak PIC</Text>
                <TextInput
                  style={s.input}
                  value={formData.pic_contact || ''}
                  onChangeText={t => setFormData({ ...formData, pic_contact: t })}
                  placeholder="No. HP atau email"
                />
              </View>
            </View>
          )}

          {/* ==================== TAB: SENSOR ==================== */}
          {activeTab === 'sensor' && (
            <View style={s.section}>
              <View style={s.sensorHeader}>
                <Text style={s.sectionTitle}>Daftar Sensor / Parameter</Text>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() =>
                    setParamsList([...paramsList, {
                      label: '',
                      topic: `temins_iot/${selectedUser?.device_unique_id || 'ID'}/data/`,
                      unit: '',
                      is_visible: true,
                      is_chart: false,
                      chart_order: 10,
                      chart_data: ''
                    }])
                  }
                >
                  <Plus size={14} color="white" />
                  <Text style={s.addBtnText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {paramsList.map((p, idx) => (
                <View key={idx} style={s.paramCard}>
                  <View style={s.paramCardHeader}>
                    <Text style={s.paramIdx}>Sensor {idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteParam(idx)}>
                      <Trash2 size={18} color="#e11d48" />
                    </TouchableOpacity>
                  </View>

                  <Text style={s.label}>Nama Sensor</Text>
                  <TextInput
                    style={s.input}
                    value={p.label}
                    onChangeText={t => { const n = [...paramsList]; n[idx].label = t; setParamsList(n); }}
                    placeholder="Contoh: Temperature"
                  />

                  <Text style={s.label}>Topic MQTT</Text>
                  <TextInput
                    style={s.input}
                    value={p.topic}
                    onChangeText={t => { const n = [...paramsList]; n[idx].topic = t; setParamsList(n); }}
                    placeholder="temins_iot/device/data/sensor"
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Unit</Text>
                      <TextInput
                        style={s.input}
                        value={p.unit}
                        onChangeText={t => { const n = [...paramsList]; n[idx].unit = t; setParamsList(n); }}
                        placeholder="°C, %, etc"
                      />
                    </View>
                    <View style={s.switchBox}>
                      <Text style={s.switchLabel}>Chart</Text>
                      <Switch
                        value={p.is_chart}
                        onValueChange={v => { const n = [...paramsList]; n[idx].is_chart = v; setParamsList(n); }}
                        trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                        thumbColor="white"
                      />
                    </View>
                    <View style={s.switchBox}>
                      <Text style={s.switchLabel}>Visible</Text>
                      <Switch
                        value={p.is_visible}
                        onValueChange={v => { const n = [...paramsList]; n[idx].is_visible = v; setParamsList(n); }}
                        trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                        thumbColor="white"
                      />
                    </View>
                  </View>

                  {p.is_chart && (
                    <View style={s.chartConfig}>
                      <Text style={s.label}>Chart Key (JSON Path)</Text>
                      <TextInput
                        style={s.input}
                        value={p.chart_data}
                        onChangeText={t => { const n = [...paramsList]; n[idx].chart_data = t; setParamsList(n); }}
                        placeholder="data.temperature"
                      />
                      <Text style={s.label}>Chart Order</Text>
                      <TextInput
                        style={s.input}
                        value={String(p.chart_order)}
                        onChangeText={t => { const n = [...paramsList]; n[idx].chart_order = parseInt(t) || 10; setParamsList(n); }}
                        placeholder="Urutan grafik (111 = AWLR utama)"
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ==================== TAB: OTOMASI ==================== */}
          {activeTab === 'otomasi' && (
            <View style={s.section}>
              {/* Header */}
              <View style={s.sensorHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Konfigurasi Otomasi</Text>
                  <Text style={s.sectionSubtitle}>Pemicu notifikasi otomatis berdasarkan nilai sensor</Text>
                </View>
                <TouchableOpacity style={s.addBtnGreen} onPress={addAutomation}>
                  <Plus size={14} color="white" />
                  <Text style={s.addBtnText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {/* Empty state */}
              {automationsList.length === 0 && (
                <View style={s.emptyState}>
                  <View style={s.emptyIcon}>
                    <Zap size={32} color="#94a3b8" />
                  </View>
                  <Text style={s.emptyTitle}>Belum ada aturan otomasi</Text>
                  <Text style={s.emptyText}>Klik tombol Tambah untuk membuat aturan baru.</Text>
                </View>
              )}

              {/* Automation rules list */}
              {automationsList.map((auto, idx) => (
                <View key={idx} style={s.autoCard}>
                  {/* Card Header */}
                  <View style={s.autoCardHeader}>
                    <View style={s.autoCardBadge}>
                      <Zap size={12} color="#6366f1" />
                      <Text style={s.autoCardBadgeText}>Aturan {idx + 1}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeAutomation(idx)} style={s.autoDeleteBtn}>
                      <Trash2 size={16} color="#e11d48" />
                    </TouchableOpacity>
                  </View>

                  {/* Parameter selector */}
                  <Text style={s.label}>Parameter Sensor</Text>
                  <View style={s.picker}>
                    <Picker
                      selectedValue={auto.parameter_name}
                      onValueChange={v => updateAutomation(idx, 'parameter_name', v)}
                    >
                      {paramsList.map((p, i) => (
                        <Picker.Item
                          key={i}
                          label={`${p.label}${p.chart_data ? ` (${p.chart_data})` : ''}`}
                          value={p.chart_data || p.label}
                        />
                      ))}
                      {/* Keep existing value if not found in paramsList */}
                      {!paramsList.find(p => (p.chart_data || p.label) === auto.parameter_name) && (
                        <Picker.Item label={auto.parameter_name} value={auto.parameter_name} />
                      )}
                    </Picker>
                  </View>

                  {/* Operator & Threshold row */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Kondisi</Text>
                      <View style={s.picker}>
                        <Picker
                          selectedValue={auto.operator}
                          onValueChange={v => updateAutomation(idx, 'operator', v)}
                        >
                          <Picker.Item label="> (Lebih dari)" value=">" />
                          <Picker.Item label="< (Kurang dari)" value="<" />
                          <Picker.Item label="= (Sama dengan)" value="=" />
                        </Picker>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Nilai Batas</Text>
                      <TextInput
                        style={[s.input, { textAlign: 'center' }]}
                        value={String(auto.threshold)}
                        onChangeText={t => updateAutomation(idx, 'threshold', t)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </View>

                  {/* Actions */}
                  <Text style={s.label}>Aksi Notifikasi</Text>
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={[s.actionToggle, auto.send_notification && s.actionToggleActive]}
                      onPress={() => updateAutomation(idx, 'send_notification', !auto.send_notification)}
                    >
                      <View style={[s.actionDot, auto.send_notification && s.actionDotActive]} />
                      <Text style={[s.actionToggleText, auto.send_notification && s.actionToggleTextActive]}>
                        Push Notifikasi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.actionToggle, auto.send_email && s.actionToggleEmailActive]}
                      onPress={() => updateAutomation(idx, 'send_email', !auto.send_email)}
                    >
                      <View style={[s.actionDot, auto.send_email && s.actionDotEmailActive]} />
                      <Text style={[s.actionToggleText, auto.send_email && s.actionToggleEmailText]}>
                        Kirim Email
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Batal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={onSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color="white" size="small" />
              : <>
                  <Save size={18} color="white" />
                  <Text style={s.saveText}>Simpan Konfigurasi</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  title: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16, paddingTop: 8,
  },
  tabItem: {
    marginRight: 16, paddingBottom: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#6366f1' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#6366f1' },

  form: { flex: 1 },
  section: {
    backgroundColor: 'white', marginHorizontal: 16, marginTop: 14,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14, fontWeight: 'bold', color: '#0f172a',
    marginBottom: 4, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sectionSubtitle: {
    fontSize: 12, color: '#64748b', marginBottom: 12,
  },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#1e293b',
  },
  picker: {
    color: '#000000ff', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, overflow: 'hidden',
  },
  hint: { fontSize: 11, color: '#6366f1', marginTop: 4 },

  // AWLR
  awlrCard: {
    backgroundColor: '#e0f2fe', marginHorizontal: 16, marginTop: 14,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bae6fd',
  },
  awlrRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  awlrTitle: { fontSize: 15, fontWeight: 'bold', color: '#0c4a6e' },
  awlrSub: { fontSize: 12, color: '#0284c7', marginTop: 2 },
  awlrAlert: { fontSize: 12, fontWeight: '700', color: '#1d4ed8', marginBottom: 12, backgroundColor: '#dbeafe', padding: 8, borderRadius: 8 },
  modeSwitcher: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8, padding: 3, marginBottom: 14,
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  modeBtnActive: { backgroundColor: '#0284c7' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#0ea5e9' },
  modeBtnTextActive: { color: 'white' },
  opRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  opBtn: { width: 36, height: 36, backgroundColor: '#dbeafe', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  opBtnText: { color: '#1d4ed8', fontWeight: 'bold', fontSize: 16 },

  // Sensor
  sensorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnGreen: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  paramCard: {
    backgroundColor: '#f8fafc', borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 12,
  },
  paramCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paramIdx: { fontSize: 13, fontWeight: '700', color: '#475569' },
  switchBox: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  switchLabel: { fontSize: 11, color: '#64748b', marginBottom: 4, marginTop: 10 },
  chartConfig: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginTop: 8 },

  // Automation
  emptyState: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  autoCard: {
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 12,
  },
  autoCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  autoCardBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  autoCardBadgeText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },
  autoDeleteBtn: {
    padding: 6, borderRadius: 8, backgroundColor: '#fff1f2',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionToggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  actionToggleActive: {
    borderColor: '#6366f1', backgroundColor: '#ede9fe',
  },
  actionToggleEmailActive: {
    borderColor: '#10b981', backgroundColor: '#ecfdf5',
  },
  actionDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  actionDotActive: { backgroundColor: '#6366f1' },
  actionDotEmailActive: { backgroundColor: '#10b981' },
  actionToggleText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  actionToggleTextActive: { color: '#6366f1' },
  actionToggleEmailText: { color: '#10b981' },

  // Footer
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  cancelBtn: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 12,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  saveBtn: {
    flex: 2, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6366f1', borderRadius: 12, gap: 8,
  },
  saveText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
