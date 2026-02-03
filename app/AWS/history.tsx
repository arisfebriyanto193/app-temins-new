import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Konfigurasi API (Ganti dengan URL Anda)
const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
const API_DATA_URL = `${process.env.EXPO_PUBLIC_API_DATA}`;
const API_TOKEN_INTERNAL = `${process.env.EXPO_PUBLIC_API_TOKEN}`;

export default function AnalyticsPage() {
  // --- STATE UI ---
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // --- STATE CONFIG ---
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('AWS Device');
  const [zonawaktu, setZonawaktu] = useState('WIB');
  const [sensors, setSensors] = useState([]);
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

  // --- STATE FILTER ---
  const [selectedSensor, setSelectedSensor] = useState('');
  const [period, setPeriod] = useState('hari');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  // --- STATE DOWNLOAD & PREVIEW ---
  const [downloadMonth, setDownloadMonth] = useState(String(new Date().getMonth() + 1));
  const [downloadYear, setDownloadYear] = useState(String(new Date().getFullYear()));
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [previewData, setPreviewData] = useState([]);

  // --- STATE CHART ---
  const [chartDataPoints, setChartDataPoints] = useState([]);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const activeSensorConfig = useMemo(() => {
    return sensors.find(s => s.code === selectedSensor) || { color: '#6366f1', unit: '-', label: 'Sensor' };
  }, [selectedSensor, sensors]);

  // --- 1. LOAD CONFIG AWAL ---
  useEffect(() => {
    fetchInit();
  }, []);

  const fetchInit = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      const url = `${API_BASE_URL}/api-app/user/aws/history.php`;
      const res = await fetch(`${url}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      console.log("init", json);
      console.log("token", token);
      console.log("url data", url);
      if (json.status) {
        setDeviceName(json.device_name);
        setDeviceId(json.device_id);
        setZonawaktu(json.zonawaktu);
        setSensors(json.sensors);
        setAvailableYears(json.years);
        if (json.sensors.length > 0) setSelectedSensor(json.sensors[0].code);
      }
    } catch (e) {
      Alert.alert("Error", "Gagal memuat konfigurasi awal");
    } finally {
      setLoadingInit(false);
    }
  };

  // --- 2. FETCH CHART DATA ---
  useEffect(() => {
    if (deviceId && selectedSensor) {
      fetchChartData();
    }
  }, [deviceId, selectedSensor, period, month, year]);

  const fetchChartData = async () => {
    setLoadingData(true);
    let url = `${API_DATA_URL}/api/get-data?device_id=${deviceId}&jenis=${selectedSensor}&periode=${period}&mode=ringkas`;
    if (period === 'bulan') url += `&bulan=${month}&tahun=${year}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_TOKEN_INTERNAL}` }
      });
      console.log("grafik", res);
      console.log("grafik url", url);
      const json = await res.json();
      if (json.status && Array.isArray(json.data)) {
        // Menggunakan semua data tanpa sampling
        setChartDataPoints(json.data);
      } else {
        setChartDataPoints([]);
      }
    } catch (e) {
      setChartDataPoints([]);
    } finally {
      setLoadingData(false);
    }
  };

  // --- 3. DOWNLOAD & PREVIEW LOGIC ---
  const fetchPreviewData = async (format) => {
    setSelectedFormat(format);
    setShowDownloadModal(true);
    setLoadingPreview(true);

    const formattedMonth = String(downloadMonth).padStart(2, "0");
    const sensorCodes = sensors.map(s => s.code).join(",");
    const url = `${API_DATA_URL}/api/get-data?device_id=${deviceId}&jenis=${sensorCodes}&mode=ringkas&bulan=${formattedMonth}-${downloadYear}&zonawaktu=${zonawaktu}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_TOKEN_INTERNAL}` }
      });
      const json = await res.json();
      if (json.status && json.data) {
        const groupedByTime = {};
        json.data.forEach(item => {
          if (!groupedByTime[item.recorded_at]) {
            groupedByTime[item.recorded_at] = { time: item.recorded_at };
          }
          groupedByTime[item.recorded_at][item.parameter_name] = item.value;
        });
        const finalData = Object.values(groupedByTime).sort((a, b) =>
          new Date(b.time).getTime() - new Date(a.time).getTime()
        );
        setPreviewData(finalData);
      }
    } catch (e) {
      Alert.alert("Error", "Gagal memuat pratinjau");
    } finally {
      setLoadingPreview(false);
    }
  };

  const executeDownload = () => {
    const formattedMonth = String(downloadMonth).padStart(2, "0");
    const sensorCodes = sensors.map(s => s.code).join(",");
    const sensorMeta = sensors.map(s => `${s.code}:${s.label} (${s.unit})`).join(",");

    let url = `${API_DATA_URL}/api/export/excel-multi` +
      `?device_id=${deviceId}` +
      `&bulan=${formattedMonth}` +
      `&zonawaktu=${zonawaktu}` +
      `&tahun=${downloadYear}` +
      `&sensors=${encodeURIComponent(sensorCodes)}` +
      `&sensor_meta=${encodeURIComponent(sensorMeta)}`;

    if (selectedFormat === 'csv') url += `&out=csv`;

    Linking.openURL(url);
    setShowDownloadModal(false);
  };

  // --- CHART FORMATTING ---
  const getChartData = () => {
    if (chartDataPoints.length === 0) return null;
    
    // Menggunakan SEMUA data tanpa sampling untuk dataset
    const data = chartDataPoints.map(d => parseFloat(d.value) || 0);
    
    // Untuk label, kita ambil beberapa titik agar tidak terlalu padat
    // Tapi tetap menampilkan semua data di grafik
    let labels = [];
    const totalPoints = chartDataPoints.length;
    
    if (totalPoints <= 10) {
      // Jika data sedikit, tampilkan semua label
      labels = chartDataPoints.map(d => {
        const date = new Date(d.recorded_at);
        if (period === 'hari') {
          return `${date.getHours()}:00`;
        } else {
          return `${date.getDate()}/${date.getMonth() + 1}`;
        }
      });
    } else {
      // Jika data banyak, ambil 10 label secara merata
      const step = Math.floor(totalPoints / 10);
      for (let i = 0; i < totalPoints; i += step) {
        const date = new Date(chartDataPoints[i].recorded_at);
        if (period === 'hari') {
          labels.push(`${date.getHours()}:00`);
        } else {
          labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
        }
      }
      // Pastikan maksimal 10 label
      labels = labels.slice(0, 10);
    }

    return {
      labels: labels,
      datasets: [{
        data: data,
        color: (opacity = 1) => activeSensorConfig.color || `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 2
      }],
      legend: [`${activeSensorConfig.label} (${chartDataPoints.length} data points)`]
    };
  };

  if (loadingInit) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Memuat konfigurasi...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analitik Sensor</Text>
        <Text style={styles.headerSubtitle}>Timezone: {zonawaktu} | Device: {deviceName}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* DOWNLOAD SECTION */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="cloud-download-outline" size={24} color="#6366f1" />
            <View style={styles.ml10}>
              <Text style={styles.cardBold}>Download Data Semua Sensor</Text>
              <Text style={styles.cardSmall}>Pilih bulan untuk unduh Excel/CSV</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={downloadMonth}
                onValueChange={(v) => setDownloadMonth(v)}
                style={styles.picker}
                dropdownIconColor="#000000"
              >
                {monthNames.map((m, i) => (
                  <Picker.Item 
                    key={i} 
                    label={m} 
                    value={String(i + 1)} 
                    style={styles.pickerItem} 
                  />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerContainer, { width: 100 }]}>
              <Picker
                selectedValue={downloadYear}
                onValueChange={(v) => setDownloadYear(v)}
                style={styles.picker}
                dropdownIconColor="#000000"
              >
                {availableYears.map(y => (
                  <Picker.Item 
                    key={y} 
                    label={String(y)} 
                    value={String(y)} 
                    style={styles.pickerItem}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.btnExcel} onPress={() => fetchPreviewData('excel')}>
              <Ionicons name="file-tray-full-outline" size={18} color="white" />
              <Text style={styles.btnText}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCsv} onPress={() => fetchPreviewData('csv')}>
              <Ionicons name="document-text-outline" size={18} color="white" />
              <Text style={styles.btnText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ANALYTICS CONTROL */}
        <View style={styles.card}>
          <Text style={styles.label}>PILIH SENSOR</Text>
          <View style={styles.pickerContainerFull}>
            <Picker
              selectedValue={selectedSensor}
              onValueChange={(v) => setSelectedSensor(v)}
              style={styles.picker}
              dropdownIconColor="#000000"
            >
              {sensors.map(s => (
                <Picker.Item 
                  key={s.code} 
                  label={s.label} 
                  value={s.code} 
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
          <Text style={styles.unitText}>Satuan: {activeSensorConfig.unit}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>PERIODE GRAFIK</Text>
          
          <View style={styles.pickerContainerFull}>
            <Picker
              selectedValue={period}
              onValueChange={(v) => setPeriod(v)}
              style={styles.picker}
              dropdownIconColor="#000000"
            >
              <Picker.Item label="24 Jam Terakhir" value="hari" style={styles.pickerItem} />
              <Picker.Item label="7 Hari Terakhir" value="minggu_ini" style={styles.pickerItem} />
              <Picker.Item label="Per Bulan" value="bulan" style={styles.pickerItem} />
            </Picker>
          </View>

          {period === 'bulan' && (
            <View style={styles.filterRow}>
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={month} 
                  onValueChange={setMonth}
                  style={styles.picker}
                  dropdownIconColor="#000000"
                >
                  {monthNames.map((m, i) => (
                    <Picker.Item 
                      key={i} 
                      label={m} 
                      value={String(i + 1)} 
                      style={styles.pickerItem}
                    />
                  ))} 
                </Picker>
              </View>
              <View style={[styles.pickerContainer, { width: 100 }]}>
                <Picker 
                  selectedValue={year} 
                  onValueChange={setYear}
                  style={styles.picker}
                  dropdownIconColor="#000000"
                >
                  {availableYears.map(y => (
                    <Picker.Item 
                      key={y} 
                      label={String(y)} 
                      value={String(y)} 
                      style={styles.pickerItem}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}
        </View>

        {/* CHART SECTION */}
        <View style={styles.card}>
          <Text style={styles.cardBold}>Grafik {activeSensorConfig.label}</Text>
          <Text style={styles.dataCount}>
            Total Data: {chartDataPoints.length} titik
          </Text>
          {loadingData ? (
            <ActivityIndicator style={{ height: 220 }} color="#6366f1" />
          ) : getChartData() ? (
            <>
              <LineChart
                data={getChartData()}
                width={SCREEN_WIDTH - 60}
                height={220}
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 1,
                  color: (opacity = 1) => activeSensorConfig.color || `rgba(99, 102, 241, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "3", strokeWidth: "1" },
                  propsForBackgroundLines: { strokeDasharray: "" }
                }}
                bezier
                style={styles.chart}
                fromZero={activeSensorConfig.unit === 'RH' || activeSensorConfig.unit === '%'}
                withVerticalLines={chartDataPoints.length <= 50} // Hanya tampilkan garis vertikal jika data tidak terlalu banyak
                withHorizontalLines={true}
                segments={5}
              />
              <Text style={styles.chartNote}>
                * Grafik menampilkan {chartDataPoints.length} data point secara penuh
              </Text>
            </>
          ) : (
            <View style={styles.emptyChart}>
              <Ionicons name="stats-chart-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Tidak ada data ditemukan</Text>
              <Text style={styles.emptySubtext}>Coba pilih periode atau sensor lain</Text>
            </View>
          )}
        </View>

        {/* DATA TABLE PREVIEW */}
        {chartDataPoints.length > 0 && !loadingData && (
          <View style={styles.card}>
            <Text style={styles.cardBold}>Data Terbaru</Text>
            <Text style={styles.cardSmall}>Menampilkan 10 data terbaru dari {chartDataPoints.length} total data</Text>
            
            <ScrollView horizontal style={styles.tableContainer}>
              <View>
                {/* Header */}
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Waktu</Text>
                  <Text style={styles.tableHeaderCell}>Nilai</Text>
                  <Text style={styles.tableHeaderCell}>Unit</Text>
                </View>
                
                {/* Data Rows */}
                {chartDataPoints.slice(0, 10).map((item, index) => {
                  const date = new Date(item.recorded_at);
                  return (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCell}>
                        {period === 'hari' 
                          ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                          : `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                        }
                      </Text>
                      <Text style={styles.tableCell}>{parseFloat(item.value).toFixed(1)}</Text>
                      <Text style={styles.tableCell}>{activeSensorConfig.unit}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            
            {chartDataPoints.length > 10 && (
              <Text style={styles.moreDataText}>
                + {chartDataPoints.length - 10} data lainnya...
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DOWNLOAD MODAL */}
      <Modal 
        visible={showDownloadModal} 
        animationType="slide"
        onRequestClose={() => setShowDownloadModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Pratinjau {selectedFormat.toUpperCase()}</Text>
              <Text style={styles.modalSubtitle}>
                {monthNames[parseInt(downloadMonth) - 1]} {downloadYear} | {sensors.length} Sensor
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowDownloadModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000000" />
            </TouchableOpacity>
          </View>

          {loadingPreview ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Menyiapkan data...</Text>
            </View>
          ) : previewData.length > 0 ? (
            <>
              <ScrollView horizontal style={styles.modalScrollView}>
                <View>
                  {/* Tabel Header */}
                  <View style={styles.modalTableHeader}>
                    <Text style={styles.modalTableHeaderText}>Waktu</Text>
                    {sensors.map(s => (
                      <Text key={s.code} style={styles.modalTableHeaderText}>
                        {s.label} ({s.unit})
                      </Text>
                    ))}
                  </View>
                  
                  {/* Tabel Body */}
                  <FlatList
                    data={previewData.slice(0, 50)} // Batasi preview ke 50 baris
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <View style={styles.modalTableRow}>
                        <Text style={styles.modalTableCell}>{item.time}</Text>
                        {sensors.map(s => (
                          <Text key={s.code} style={styles.modalTableCell}>
                            {item[s.code] ? parseFloat(item[s.code]).toFixed(2) : '-'}
                          </Text>
                        ))}
                      </View>
                    )}
                    ListFooterComponent={() => (
                      previewData.length > 50 ? (
                        <View style={styles.footerNote}>
                          <Text style={styles.footerNoteText}>
                            ... dan {previewData.length - 50} baris lainnya
                          </Text>
                        </View>
                      ) : null
                    )}
                  />
                </View>
              </ScrollView>
              
              <Text style={styles.totalDataText}>
                Total Data: {previewData.length} baris × {sensors.length + 1} kolom
              </Text>
            </>
          ) : (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyText}>Tidak ada data untuk pratinjau</Text>
              <Text style={styles.emptySubtext}>Coba pilih bulan atau tahun lain</Text>
            </View>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.btnCancel} 
              onPress={() => setShowDownloadModal(false)}
            >
              <Text style={styles.btnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnDownload, { 
                backgroundColor: selectedFormat === 'excel' ? '#16a34a' : '#2563eb',
                opacity: previewData.length > 0 ? 1 : 0.5
              }]} 
              onPress={previewData.length > 0 ? executeDownload : null}
              disabled={previewData.length === 0}
            >
              <Ionicons 
                name={selectedFormat === 'excel' ? "excel" : "document-text"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.btnDownloadText}>
                Download {selectedFormat.toUpperCase()} ({previewData.length} data)
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748b' },
  
  // HEADER
  header: { 
    padding: 20, 
    backgroundColor: 'white', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#64748b',
  },
  
  // CONTENT
  content: { padding: 15, backgroundColor: '#f8fafc' },
  
  // CARD
  card: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardBold: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#0f172a',
    marginBottom: 4,
  },
  cardSmall: { 
    fontSize: 13, 
    color: '#64748b',
  },
  
  // ROW
  row: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 15,
  },
  ml10: { marginLeft: 12 },
  
  // FILTER ROW
  filterRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 15,
  },
  
  // PICKER
  pickerContainer: { 
    flex: 1, 
    backgroundColor: '#ffffffff', 
    borderRadius: 8, 
    height: 50, 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerContainerFull: { 
    backgroundColor: '#f1f5f9', 
    borderRadius: 8, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  picker: { 
    color: '#000000',
    height: 50,
  },
  pickerItem: {
    color: '#000000',
    fontSize: 14,
    backgroundColor: '#ffffffff',
  },
  
  // BUTTONS
  buttonRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 20,
  },
  btnExcel: { 
    flex: 1, 
    backgroundColor: '#16a34a', 
    flexDirection: 'row', 
    padding: 14, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  btnCsv: { 
    flex: 1, 
    backgroundColor: '#2563eb', 
    flexDirection: 'row', 
    padding: 14, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  btnText: { 
    color: 'white', 
    fontWeight: '600',
    fontSize: 14,
  },
  
  // LABELS
  label: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#64748b', 
    marginTop: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitText: { 
    fontSize: 13, 
    color: '#475569', 
    fontStyle: 'italic', 
    marginTop: 8,
  },
  dataCount: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
  },
  
  // DIVIDER
  divider: { 
    height: 1, 
    backgroundColor: '#e2e8f0', 
    marginVertical: 20,
  },
  
  // CHART
  chart: { 
    marginVertical: 10, 
    borderRadius: 12,
  },
  chartNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  
  // EMPTY STATES
  emptyChart: { 
    height: 220, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 12, 
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: { 
    fontSize: 16, 
    color: '#475569',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // TABLE
  tableContainer: {
    marginTop: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    width: 100,
    fontWeight: '600',
    fontSize: 13,
    color: '#0f172a',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'white',
  },
  tableCell: {
    width: 100,
    fontSize: 13,
    color: '#334155',
  },
  moreDataText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  
  // MODAL
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'white',
  },
  modalHeader: { 
    padding: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  modalTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTableHeaderText: {
    width: 120,
    fontWeight: '600',
    fontSize: 12,
    color: '#0f172a',
    marginRight: 10,
  },
  modalTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTableCell: {
    width: 120,
    fontSize: 12,
    color: '#334155',
    marginRight: 10,
  },
  totalDataText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  footerNote: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  footerNoteText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  
  // MODAL FOOTER
  modalFooter: { 
    padding: 20, 
    flexDirection: 'row', 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  btnCancel: { 
    flex: 1, 
    padding: 15, 
    alignItems: 'center', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#cbd5e1',
    backgroundColor: 'white',
  },
  btnCancelText: { 
    color: '#64748b',
    fontWeight: '500',
  },
  btnDownload: { 
    flex: 2, 
    padding: 15, 
    alignItems: 'center', 
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  btnDownloadText: { 
    color: 'white', 
    fontWeight: '600',
    fontSize: 14,
  },
});