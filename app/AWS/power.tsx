import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Dimensions, SafeAreaView, ActivityIndicator, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import mqtt from 'mqtt';
import { Buffer } from 'buffer';

// Polyfill untuk MQTT di React Native
global.Buffer = Buffer;

const screenWidth = Dimensions.get("window").width;

export default function PowerPage() {
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState(null);
  const [sensorValues, setSensorValues] = useState({});
  
  // Chart States
  const [chartSensor, setChartSensor] = useState("");
  const [chartPeriod, setChartPeriod] = useState("hari");
  const [chartData, setChartData] = useState(null);

  const clientRef = useRef(null);
  const lastMsgTime = useRef(Date.now());

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
  const API_TOKEN_INTERNAL = `${process.env.EXPO_PUBLIC_API_TOKEN}`;

  // === 1. FETCH CONFIG & INIT ===
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const token = await AsyncStorage.getItem('user_token');
        if (!token) {
          Alert.alert("Error", "Sesi berakhir, silakan login kembali");
          return;
        }

        const res = await fetch(`${API_URL}/api-app/user/aws/power.php`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status) {
          setConfig(data);
          // Set initial values
          const initials = {};
          data.sensors.forEach(s => { initials[s.topic] = s.value; });
          setSensorValues(initials);
          
          if (data.sensors.length > 0) setChartSensor(data.sensors[0].code);
        }
      } catch (e) {
        console.error("Init Failed", e);
      } finally {
        setLoading(false);
      }
    };

    fetchInit();
  }, []);

  // === 2. MQTT CONNECTION ===
  useEffect(() => {
    if (!config) return;

    const brokerURL = "wss://karsacerdasinovatif.web.id:8081";
    const clientId = "rn_pwr_" + Math.random().toString(16).substr(2, 5);

    const client = mqtt.connect(brokerURL, { clientId, clean: true, reconnectPeriod: 3000 });

    client.on("connect", () => {
      setIsConnected(true);
      config.mqtt_topics.forEach((t) => client.subscribe(t));
    });

    client.on("message", (topic, payload) => {
      const val = parseFloat(payload.toString());
      lastMsgTime.current = Date.now();
      setIsConnected(true);
      setSensorValues(prev => ({ ...prev, [topic]: val }));
    });

    client.on("close", () => setIsConnected(false));
    
    clientRef.current = client;

    return () => { if(client) client.end(); };
  }, [config]);

  // Fungsi untuk memformat waktu berdasarkan periode
  const formatTimeLabel = (timestamp, period) => {
    const date = new Date(timestamp);
    
    if (period === 'hari') {
      // Format: HH:MM
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (period === 'minggu_ini') {
      // Format: Hari, DD/MM
      const days = ['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const dayName = days[date.getDay()];
      return `${dayName}, ${date.getDate().toString().padStart(2, '0')}`;
    } else if (period === 'bulan') {
      // Format: DD/MM
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    
    return timestamp;
  };

  // === 3. FETCH CHART DATA ===
  useEffect(() => {
    if (!config || !chartSensor) return;

    const fetchChart = async () => {
      const url = `${process.env.EXPO_PUBLIC_API_DATA}/api/get-data?device_id=${config.device.id}&jenis=${chartSensor}&periode=${chartPeriod}&limit=8&mode=ringkas&zonawaktu=${config.device.zonawaktu}`;
      
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${API_TOKEN_INTERNAL}` }
        });
        const json = await res.json();
        console.log("chart data", json);
        if (json.status && json.data.length > 0) {
          const labels = [];
          const dataPoints = [];
          
          // Tentukan jumlah maksimal titik data untuk tampilan mobile
          const maxDataPoints = 10;
          const step = Math.max(1, Math.floor(json.data.length / maxDataPoints));
          
          // Ambil data dengan interval yang merata
          for (let i = 0; i < json.data.length; i += step) {
            const item = json.data[i];
            labels.push(formatTimeLabel(item.recorded_at, chartPeriod));
            dataPoints.push(parseFloat(item.value));
          }
          
          // Pastikan data terakhir selalu masuk
          if (json.data.length > 0) {
            const lastItem = json.data[json.data.length - 1];
            const lastLabel = formatTimeLabel(lastItem.recorded_at, chartPeriod);
            
            // Cek apakah data terakhir sudah termasuk
            if (labels[labels.length - 1] !== lastLabel) {
              labels.push(lastLabel);
              dataPoints.push(parseFloat(lastItem.value));
            }
          }

          // Pastikan tidak terlalu banyak label
          if (labels.length > 12) {
            const reducedLabels = [];
            const reducedDataPoints = [];
            const reductionStep = Math.ceil(labels.length / 8);
            
            for (let i = 0; i < labels.length; i += reductionStep) {
              reducedLabels.push(labels[i]);
              reducedDataPoints.push(dataPoints[i]);
            }
            
            // Tambahkan data terakhir jika belum masuk
            if (reducedLabels[reducedLabels.length - 1] !== labels[labels.length - 1]) {
              reducedLabels.push(labels[labels.length - 1]);
              reducedDataPoints.push(dataPoints[dataPoints.length - 1]);
            }
            
            setChartData({
              labels: reducedLabels,
              datasets: [{ data: reducedDataPoints }]
            });
          } else {
            setChartData({
              labels: labels,
              datasets: [{ data: dataPoints }]
            });
          }
        } else {
          setChartData(null);
        }
      } catch (e) {
        console.error(e);
        setChartData(null);
      }
    };

    fetchChart();
  }, [config, chartSensor, chartPeriod]);

  // === 4. HELPER CALCULATIONS ===
  const getVal = (topic) => sensorValues[topic] ?? 0;
  const sensorVolt = config?.sensors.find(s => s.type_id === 'volt');
  const currentVolt = sensorVolt ? getVal(sensorVolt.topic) : 0;

  // Ambil nilai Charging dari topic data/ac (dalam Ampere)
  const acTopic = Object.keys(sensorValues).find(t => t.includes('data/ac'));
  let chargingAmp = acTopic ? getVal(acTopic) : 0;
  chargingAmp = chargingAmp / 1000;

  let battPct = ((currentVolt - 10.8) / (14.7 - 10.8)) * 100;
  battPct = Math.max(0, Math.min(100, battPct));

  if (loading || !config) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{marginTop: 10}}>Memuat Data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text ></Text>
          <Text style={styles.title}>Power System</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, {backgroundColor: isConnected ? '#22c55e' : '#ef4444'}]} />
            <Text style={[styles.statusText, {color: isConnected ? '#22c55e' : '#ef4444'}]}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>
     
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* REALTIME VISUAL CARD */}
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Energi Realtime</Text>
          
          <View style={styles.visualRow}>
            {/* Charging Power */}
            <View style={styles.mpptCircle}>
              <Text style={styles.mpptLabel}>Charging</Text>
              <Text style={styles.mpptVal}>{chargingAmp.toFixed(2)}A</Text>
              <Text style={styles.mpptSub}>{currentVolt.toFixed(1)}V</Text>
            </View>

            {/* Battery Info */}
            <View style={styles.batteryContainer}>
               <View style={styles.batteryHead} />
               <View style={styles.batteryBody}>
                  <View style={[styles.batteryLevel, { 
                    height: `${battPct}%`, 
                    backgroundColor: battPct < 20 ? '#ef4444' : '#22c55e' 
                  }]} />
                  <View style={styles.batteryInfoOverlay}>
                    <Text style={styles.battPctText}>{Math.round(battPct)}%</Text>
                  </View>
               </View>
            </View>
          </View>
        </View>

        {/* CHART SECTION */}
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Grafik Monitoring</Text>
          
          <View style={styles.pickerGroup}>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={chartSensor}
                onValueChange={(itemValue) => setChartSensor(itemValue)}
                style={styles.picker} 
              >
                {config.sensors.map(s => (
                  <Picker.Item key={s.code} label={s.label} value={s.code} color="#27292cff" />
                ))}
              </Picker>
            </View>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={chartPeriod}
                onValueChange={(itemValue) => setChartPeriod(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Hari Ini" value="hari"  color="#27292cff"/>
                <Picker.Item label="7 Hari" value="minggu_ini" color="#27292cff"/>
                <Picker.Item label="30 Hari" value="bulan" color="#27292cff" />
              </Picker>
            </View>
          </View>

          {chartData ? (
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={screenWidth - 60}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                formatYLabel={(value) => {
                  // Format angka dengan pemisah ribuan
                  const num = parseFloat(value);
                  if (num >= 1000) {
                    return (num / 1000).toFixed(1) + 'k';
                  }
                  return num.toFixed(0);
                }}
              />
              <Text style={styles.chartFooter}>
                Sumbu X: Waktu ({chartPeriod === 'hari' ? 'Jam' : 'Tanggal'})
              </Text>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>Tidak ada data historis</Text>
            </View>
          )}
        </View>

        {/* SENSOR GRID */}
        <View style={styles.grid}>
          {config.sensors.map((s) => (
            <View key={s.topic} style={styles.sensorCard}>
              <Text style={styles.sensorLabel}>{s.label}</Text>
              <View style={styles.sensorValueGroup}>
                <Text style={styles.valBig}>{getVal(s.topic)}</Text>
                <Text style={styles.unitSmall}>{s.unit}</Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

// === STYLES & CONFIG ===

const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#3b82f6" },
  propsForLabels: {
    fontSize: 10,
  },
  formatXLabel: (label) => label // Biarkan label asli dari formatTimeLabel
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  logoutBtn: { padding: 8 },
  
  content: { padding: 15 },
  glassCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#475569', marginBottom: 15 },
  
  visualRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
  mpptCircle: { 
    width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff'
  },
  mpptLabel: { fontSize: 10, color: '#3b82f6', textTransform: 'uppercase' },
  mpptVal: { fontSize: 24, fontWeight: 'bold', color: '#1e3a8a' },
  mpptSub: { fontSize: 10, color: '#64748b' },

  batteryContainer: { alignItems: 'center' },
  batteryHead: { width: 20, height: 8, backgroundColor: '#94a3b8', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  batteryBody: { 
    width: 60, height: 100, borderWidth: 3, borderColor: '#94a3b8', 
    borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' 
  },
  batteryLevel: { width: '100%' },
  batteryInfoOverlay: { 
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' 
  },
  battPctText: { fontWeight: 'bold', color: '#1e293b', fontSize: 16 },

  pickerGroup: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  pickerWrapper: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  chartContainer: { alignItems: 'center' },
  chart: { marginVertical: 8, borderRadius: 16 },
  chartFooter: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center'
  },
  noDataText: { textAlign: 'center', color: '#94a3b8', fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sensorCard: {
    width: '48%', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15,
    borderLeftWidth: 4, borderLeftColor: '#facc15', elevation: 2
  },
  sensorLabel: { fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  sensorValueGroup: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  valBig: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  unitSmall: { fontSize: 12, color: '#94a3b8', marginLeft: 4 }
});