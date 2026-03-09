import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Linking from 'expo-linking';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;
const API_DATA_URL = `${process.env.EXPO_PUBLIC_API_DATA}`;
const API_TOKEN_INTERNAL = `${process.env.EXPO_PUBLIC_API_TOKEN}`;

export default function InstansiHistory() {
  const insets = useSafeAreaInsets();
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Instansi Device');
  const [zonawaktu, setZonawaktu] = useState('WIB');
  const [sensors, setSensors] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

  const [selectedSensor, setSelectedSensor] = useState('');
  const [period, setPeriod] = useState('hari');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const [downloadMonth, setDownloadMonth] = useState(String(new Date().getMonth() + 1));
  const [downloadYear, setDownloadYear] = useState(String(new Date().getFullYear()));
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [chartDataPoints, setChartDataPoints] = useState<any[]>([]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const activeSensorConfig = useMemo(() => {
    return sensors.find(s => s.code === selectedSensor) || { color: '#3b82f6', unit: '-', label: 'Sensor' };
  }, [selectedSensor, sensors]);

  useEffect(() => {
    fetchInit();
  }, []);

  const fetchInit = async () => {
    try {
      const token = await AsyncStorage.getItem('instansi_token');
      const devId = await AsyncStorage.getItem('selected_device_id');
      
      if (!token) {
        Alert.alert('Error', 'Token instansi tidak ditemukan. Pilih akun di tab Akun.');
        setLoadingInit(false);
        return;
      }

      if (!devId) {
        setLoadingInit(false);
        return;
      }

      const API_BASE = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${API_BASE}/api-app/instansi/aws/history.php?device_id=${devId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (json.status && json.details) {
        const d = json.details;
        setDeviceName(d.device_name);
        setDeviceId(d.device_id);
        setZonawaktu(d.zonawaktu);
        setSensors(d.sensors || []);
        setAvailableYears(d.years || [new Date().getFullYear()]);
        if (d.sensors?.length > 0) setSelectedSensor(d.sensors[0].code);
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal memuat konfigurasi riwayat');
    } finally {
      setLoadingInit(false);
    }
  };

  useEffect(() => {
    if (deviceId && selectedSensor) fetchChartData();
  }, [deviceId, selectedSensor, period, month, year]);

  const fetchChartData = async () => {
    setLoadingData(true);
    let url = `${API_DATA_URL}/api/get-data?device_id=${deviceId}&jenis=${selectedSensor}&periode=${period}&mode=ringkas&limit=8`;
    if (period === 'bulan') url += `&bulan=${month}&tahun=${year}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN_INTERNAL}` } });
      const json = await res.json();
      if (json.status && Array.isArray(json.data)) {
        setChartDataPoints(json.data);
      } else {
        setChartDataPoints([]);
      }
    } catch {
      setChartDataPoints([]);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPreviewData = async (format: string) => {
    setSelectedFormat(format);
    setShowDownloadModal(true);
    setLoadingPreview(true);
    const formattedMonth = String(downloadMonth).padStart(2, '0');
    const sensorCodes = sensors.map(s => s.code).join(',');
    const url = `${API_DATA_URL}/api/get-data?device_id=${deviceId}&jenis=${sensorCodes}&mode=ringkas&bulan=${formattedMonth}-${downloadYear}&zonawaktu=${zonawaktu}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN_INTERNAL}` } });
      const json = await res.json();
      if (json.status && json.data) {
        const grouped: Record<string, any> = {};
        json.data.forEach((item: any) => {
          if (!grouped[item.recorded_at]) grouped[item.recorded_at] = { time: item.recorded_at };
          grouped[item.recorded_at][item.parameter_name] = item.value;
        });
        setPreviewData(Object.values(grouped).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
      }
    } catch {
      Alert.alert('Error', 'Gagal memuat pratinjau');
    } finally {
      setLoadingPreview(false);
    }
  };

  const executeDownload = () => {
    const formattedMonth = String(downloadMonth).padStart(2, '0');
    const sensorCodes = sensors.map(s => s.code).join(',');
    const sensorMeta = sensors.map(s => `${s.code}:${s.label} (${s.unit})`).join(',');
    let url = `${API_DATA_URL}/api/export/excel-multi?device_id=${deviceId}&bulan=${formattedMonth}&zonawaktu=${zonawaktu}&tahun=${downloadYear}&sensors=${encodeURIComponent(sensorCodes)}&sensor_meta=${encodeURIComponent(sensorMeta)}`;
    if (selectedFormat === 'csv') url += '&out=csv';
    Linking.openURL(url);
    setShowDownloadModal(false);
  };

  const getChartData = () => {
    if (chartDataPoints.length === 0) return null;
    const data = chartDataPoints.map(d => parseFloat(d.value) || 0);
    const labels = chartDataPoints.slice(0, 8).map(d => {
      const dt = new Date(d.recorded_at);
      return period === 'hari'
        ? `${dt.getHours().toString().padStart(2,'0')}:00`
        : `${dt.getDate()}/${dt.getMonth()+1}`;
    });
    return { labels, datasets: [{ data, color: () => '#3b82f6', strokeWidth: 2 }] };
  };

  if (loadingInit) {
    return (
      <View style={ss.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={ss.loadingText}>Memuat konfigurasi...</Text>
      </View>
    );
  }

  const chartData = getChartData();

  return (
    <View style={[ss.container, { paddingTop: insets.top }]}>
      <View style={ss.header}>
        <Ionicons name="business-outline" size={20} color="#3b82f6" />
        <View style={{ marginLeft: 10 }}>
          <Text style={ss.headerTitle}>Riwayat Data</Text>
          <Text style={ss.headerSub}>{deviceName} • {zonawaktu}</Text>
        </View>
      </View>

      <ScrollView style={{ padding: 15 }}>
        {/* Download Card */}
        <View style={ss.card}>
          <View style={ss.row}>
            <Ionicons name="cloud-download-outline" size={22} color="#3b82f6" />
            <View style={{ marginLeft: 10 }}>
              <Text style={ss.cardBold}>Download Data Semua Sensor</Text>
              <Text style={ss.cardSmall}>Pilih bulan untuk unduh Excel/CSV</Text>
            </View>
          </View>
          <View style={ss.filterRow}>
            <View style={ss.pickerBox}>
              <Picker selectedValue={downloadMonth} onValueChange={setDownloadMonth} style={{ height: 50, color: '#000' }}>
                {monthNames.map((m, i) => <Picker.Item key={i} label={m} value={String(i+1)} />)}
              </Picker>
            </View>
            <View style={[ss.pickerBox, { width: 100 }]}>
              <Picker selectedValue={downloadYear} onValueChange={setDownloadYear} style={{ height: 50, color: '#000' }}>
                {availableYears.map(y => <Picker.Item key={y} label={String(y)} value={String(y)} />)}
              </Picker>
            </View>
          </View>
          <View style={ss.btnRow}>
            <TouchableOpacity style={[ss.btn, { backgroundColor: '#16a34a' }]} onPress={() => fetchPreviewData('excel')}>
              <Ionicons name="file-tray-full-outline" size={16} color="white" />
              <Text style={ss.btnText}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ss.btn, { backgroundColor: '#2563eb' }]} onPress={() => fetchPreviewData('csv')}>
              <Ionicons name="document-text-outline" size={16} color="white" />
              <Text style={ss.btnText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chart Controls */}
        <View style={ss.card}>
          <Text style={ss.label}>PILIH SENSOR</Text>
          <View style={ss.pickerFull}>
            <Picker selectedValue={selectedSensor} onValueChange={setSelectedSensor} style={{ height: 50, color: '#000' }}>
              {sensors.map(s => <Picker.Item key={s.code} label={s.label} value={s.code} />)}
            </Picker>
          </View>
          <Text style={ss.label}>PERIODE GRAFIK</Text>
          <View style={ss.pickerFull}>
            <Picker selectedValue={period} onValueChange={setPeriod} style={{ height: 50, color: '#000' }}>
              <Picker.Item label="24 Jam Terakhir" value="hari" />
              <Picker.Item label="7 Hari Terakhir" value="minggu_ini" />
              <Picker.Item label="Per Bulan" value="bulan" />
            </Picker>
          </View>
          {period === 'bulan' && (
            <View style={ss.filterRow}>
              <View style={ss.pickerBox}>
                <Picker selectedValue={month} onValueChange={setMonth} style={{ height: 50, color: '#000' }}>
                  {monthNames.map((m, i) => <Picker.Item key={i} label={m} value={String(i+1)} />)}
                </Picker>
              </View>
              <View style={[ss.pickerBox, { width: 100 }]}>
                <Picker selectedValue={year} onValueChange={setYear} style={{ height: 50, color: '#000' }}>
                  {availableYears.map(y => <Picker.Item key={y} label={String(y)} value={String(y)} />)}
                </Picker>
              </View>
            </View>
          )}
        </View>

        {/* Chart */}
        <View style={ss.card}>
          <Text style={ss.cardBold}>Grafik {activeSensorConfig.label}</Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            {chartDataPoints.length} data point
          </Text>
          {loadingData ? (
            <ActivityIndicator style={{ height: 220 }} color="#3b82f6" />
          ) : chartData ? (
            <LineChart
              data={chartData}
              width={SCREEN_WIDTH - 60}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 1,
                color: () => '#3b82f6',
                labelColor: () => '#64748b',
              }}
              bezier
              style={{ borderRadius: 12 }}
            />
          ) : (
            <View style={ss.emptyChart}>
              <Ionicons name="stats-chart-outline" size={48} color="#94a3b8" />
              <Text style={{ color: '#94a3b8', marginTop: 12 }}>Tidak ada data</Text>
            </View>
          )}
        </View>

        {/* Data Table */}
        {chartDataPoints.length > 0 && !loadingData && (
          <View style={ss.card}>
            <Text style={ss.cardBold}>Data Terbaru</Text>
            <ScrollView horizontal>
              <View>
                <View style={ss.tableHeader}>
                  <Text style={ss.tableHeaderCell}>Waktu</Text>
                  <Text style={ss.tableHeaderCell}>Nilai</Text>
                  <Text style={ss.tableHeaderCell}>Unit</Text>
                </View>
                {chartDataPoints.slice(0, 10).map((item, idx) => {
                  const dt = new Date(item.recorded_at);
                  return (
                    <View key={idx} style={[ss.tableRow, idx % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                      <Text style={ss.tableCell}>{`${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`}</Text>
                      <Text style={ss.tableCell}>{parseFloat(item.value).toFixed(1)}</Text>
                      <Text style={ss.tableCell}>{activeSensorConfig.unit}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Download Modal */}
      <Modal visible={showDownloadModal} animationType="slide" onRequestClose={() => setShowDownloadModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
          <View style={ss.modalHeader}>
            <Text style={ss.modalTitle}>Pratinjau {selectedFormat.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setShowDownloadModal(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          {loadingPreview ? (
            <View style={ss.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
          ) : previewData.length > 0 ? (
            <>
              <ScrollView horizontal style={{ flex: 1 }}>
                <View>
                  <View style={ss.tableHeader}>
                    <Text style={ss.tableHeaderCell}>Waktu</Text>
                    {sensors.map(s => <Text key={s.code} style={ss.tableHeaderCell}>{s.label} ({s.unit})</Text>)}
                  </View>
                  <FlatList
                    data={previewData.slice(0, 50)}
                    keyExtractor={(_, i) => String(i)}
                    renderItem={({ item }) => (
                      <View style={ss.tableRow}>
                        <Text style={ss.tableCell}>{item.time}</Text>
                        {sensors.map(s => (
                          <Text key={s.code} style={ss.tableCell}>
                            {item[s.code] ? parseFloat(item[s.code]).toFixed(2) : '-'}
                          </Text>
                        ))}
                      </View>
                    )}
                  />
                </View>
              </ScrollView>
              <View style={[ss.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity style={ss.btnCancel} onPress={() => setShowDownloadModal(false)}>
                  <Text style={{ color: '#475569', fontWeight: '600' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ss.btnDownload, { backgroundColor: selectedFormat === 'excel' ? '#16a34a' : '#2563eb' }]}
                  onPress={executeDownload}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>
                    Download {selectedFormat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={ss.center}>
              <Ionicons name="document-text-outline" size={64} color="#94a3b8" />
              <Text style={{ color: '#94a3b8', marginTop: 12 }}>Tidak ada data</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b' },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 20,
    marginBottom: 16, elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  cardBold: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  cardSmall: { fontSize: 12, color: '#64748b' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  filterRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pickerBox: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, overflow: 'hidden' },
  pickerFull: { backgroundColor: '#f1f5f9', borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  emptyChart: { height: 180, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 6 },
  tableHeaderCell: { width: 130, fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCell: { width: 130, fontSize: 13, color: '#1e293b' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: 'white',
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  btnCancel: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 10 },
  btnDownload: { flex: 2, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});
