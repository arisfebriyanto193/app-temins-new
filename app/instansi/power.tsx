import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

export default function InstansiPower() {
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});
  const [chartSensor, setChartSensor] = useState('');
  const [chartPeriod, setChartPeriod] = useState('hari');
  const [chartData, setChartData] = useState<any>(null);

  const clientRef = useRef<any>(null);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const token = await AsyncStorage.getItem('instansi_token');
        const devId = await AsyncStorage.getItem('selected_device_id');
        
        if (!token) {
          Alert.alert('Error', 'Token instansi tidak ditemukan. Pilih akun di tab Akun.');
          setLoading(false);
          return;
        }

        if (!devId) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/api-app/instansi/aws/power.php?device_id=${devId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.status && data.selected_device_details) {
          const details = data.selected_device_details;
          setConfig(details);
          const initials: Record<string, number> = {};
          details.sensors?.forEach((s: any) => { initials[s.topic] = s.value || 0; });
          setSensorValues(initials);
          if (details.sensors?.length > 0) setChartSensor(details.sensors[0].code);
        }
      } catch (e) {
        console.error('Power init error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchInit();
  }, []);

  // MQTT
  useEffect(() => {
    if (!config) return;
    let client: any;
    try {
      const mqtt = require('mqtt');
      const brokerURL = 'wss://karsacerdasinovatif.web.id:8081';
      const clientId = 'inst_pwr_' + Math.random().toString(16).substr(2, 5);
      client = mqtt.connect(brokerURL, { clientId, clean: true, reconnectPeriod: 3000 });
      client.on('connect', () => {
        setIsConnected(true);
        config.mqtt_topics?.forEach((t: string) => client.subscribe(t));
      });
      client.on('message', (topic: string, payload: Buffer) => {
        const val = parseFloat(payload.toString());
        setIsConnected(true);
        setSensorValues(prev => ({ ...prev, [topic]: val }));
      });
      client.on('close', () => setIsConnected(false));
      clientRef.current = client;
    } catch (e) {
      console.warn('MQTT not available');
    }
    return () => { if (client) client.end(); };
  }, [config]);

  // Chart Fetch
  useEffect(() => {
    if (!config || !chartSensor) return;
    const fetchChart = async () => {
      const url = `${process.env.EXPO_PUBLIC_API_DATA}/api/get-data?device_id=${config.device?.id}&jenis=${chartSensor}&periode=${chartPeriod}&limit=8&mode=ringkas&zonawaktu=${config.device?.zonawaktu || 'WIB'}`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
        const json = await res.json();
        if (json.status && json.data?.length > 0) {
          const labels: string[] = [];
          const dataPoints: number[] = [];
          const step = Math.max(1, Math.floor(json.data.length / 10));
          for (let i = 0; i < json.data.length; i += step) {
            const dt = new Date(json.data[i].recorded_at);
            labels.push(chartPeriod === 'hari'
              ? `${dt.getHours().toString().padStart(2,'0')}:00`
              : `${dt.getDate()}/${dt.getMonth()+1}`
            );
            dataPoints.push(parseFloat(json.data[i].value));
          }
          setChartData({ labels, datasets: [{ data: dataPoints }] });
        } else {
          setChartData(null);
        }
      } catch {
        setChartData(null);
      }
    };
    fetchChart();
  }, [config, chartSensor, chartPeriod]);

  const getVal = (topic: string) => sensorValues[topic] ?? 0;
  const sensorVolt = config?.sensors?.find((s: any) => s.type_id === 'volt');
  const currentVolt = sensorVolt ? getVal(sensorVolt.topic) : 0;
  const acTopic = Object.keys(sensorValues).find(t => t.includes('data/ac'));
  const chargingAmp = acTopic ? getVal(acTopic) / 1000 : 0;
  let battPct = ((currentVolt - 10.8) / (14.7 - 10.8)) * 100;
  battPct = Math.max(0, Math.min(100, battPct));

  if (loading || !config) {
    return (
      <View style={ps.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>Memuat Power System...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={ps.container}>
      <View style={ps.header}>
        <Ionicons name="business-outline" size={20} color="#3b82f6" />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={ps.title}>Power System</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{config.device?.name || 'Instansi'}</Text>
        </View>
        <View style={ps.statusRow}>
          <View style={[ps.dot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
          <Text style={[ps.statusText, { color: isConnected ? '#22c55e' : '#ef4444' }]}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <ScrollView style={ps.content} showsVerticalScrollIndicator={false}>
        {/* Realtime Card */}
        <View style={ps.glassCard}>
          <Text style={ps.cardTitle}>Energi Realtime</Text>
          <View style={ps.visualRow}>
            <View style={ps.mpptCircle}>
              <Text style={ps.mpptLabel}>Charging</Text>
              <Text style={ps.mpptVal}>{chargingAmp.toFixed(2)}A</Text>
              <Text style={ps.mpptSub}>{currentVolt.toFixed(1)}V</Text>
            </View>
            <View style={ps.batteryContainer}>
              <View style={ps.batteryHead} />
              <View style={ps.batteryBody}>
                <View style={[ps.batteryLevel, {
                  height: `${battPct}%`,
                  backgroundColor: battPct < 20 ? '#ef4444' : '#22c55e'
                }]} />
                <View style={ps.batteryInfoOverlay}>
                  <Text style={ps.battPctText}>{Math.round(battPct)}%</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={ps.glassCard}>
          <Text style={ps.cardTitle}>Grafik Monitoring</Text>
          <View style={ps.pickerGroup}>
            <View style={ps.pickerWrapper}>
              <Picker selectedValue={chartSensor} onValueChange={setChartSensor} style={{ height: 50, color: '#000' }}>
                {config.sensors?.map((s: any) => <Picker.Item key={s.code} label={s.label} value={s.code} color="#000" />)}
              </Picker>
            </View>
            <View style={ps.pickerWrapper}>
              <Picker selectedValue={chartPeriod} onValueChange={setChartPeriod} style={{ height: 50, color: '#000' }}>
                <Picker.Item label="Hari Ini" value="hari" color="#000" />
                <Picker.Item label="7 Hari" value="minggu_ini" color="#000" />
                <Picker.Item label="30 Hari" value="bulan" color="#000" />
              </Picker>
            </View>
          </View>
          {chartData ? (
            <LineChart
              data={chartData}
              width={screenWidth - 60}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: () => '#94a3b8',
              }}
              bezier
              style={{ borderRadius: 16 }}
            />
          ) : (
            <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="analytics-outline" size={48} color="#94a3b8" />
              <Text style={{ color: '#94a3b8', marginTop: 12 }}>Tidak ada data historis</Text>
            </View>
          )}
        </View>

        {/* Sensor Grid */}
        <View style={ps.grid}>
          {config.sensors?.map((s: any) => (
            <View key={s.topic} style={ps.sensorCard}>
              <Text style={ps.sensorLabel}>{s.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
                <Text style={ps.valBig}>{getVal(s.topic).toFixed(1)}</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>{s.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  content: { padding: 15 },
  glassCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#475569', marginBottom: 15 },
  visualRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
  mpptCircle: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff',
  },
  mpptLabel: { fontSize: 10, color: '#3b82f6', textTransform: 'uppercase' },
  mpptVal: { fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' },
  mpptSub: { fontSize: 10, color: '#64748b' },
  batteryContainer: { alignItems: 'center' },
  batteryHead: { width: 20, height: 8, backgroundColor: '#94a3b8', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  batteryBody: { width: 60, height: 100, borderWidth: 3, borderColor: '#94a3b8', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  batteryLevel: { width: '100%' },
  batteryInfoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  battPctText: { fontWeight: 'bold', color: '#1e293b', fontSize: 16 },
  pickerGroup: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  pickerWrapper: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sensorCard: {
    width: '48%', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15,
    borderLeftWidth: 4, borderLeftColor: '#3b82f6', elevation: 2,
  },
  sensorLabel: { fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  valBig: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
});
