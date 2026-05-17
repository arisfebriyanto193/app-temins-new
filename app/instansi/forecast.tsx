import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import mqtt from 'mqtt';

interface SensorValue {
  value: number;
  unit: string;
  label: string;
  recorded_at: string;
}

interface ForecastResult {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  accentColor: string;
  desc: string;
}

function computeForecast(vals: Record<string, SensorValue>): ForecastResult {
  const cp = vals['ch']?.value ?? 0;
  const su = vals['su']?.value ?? 0;
  const ku = vals['ku']?.value ?? 0;
  const rm = vals['rm']?.value ?? 0;

  if (cp > 0.5) return {
    title: 'Hujan', icon: 'rainy', iconColor: '#3b82f6',
    bgColor: '#eff6ff', accentColor: '#3b82f6',
    desc: 'Terpantau presipitasi hujan. Siapkan perlengkapan anti-air jika beraktivitas di luar.',
  };
  if (cp > 0 && cp <= 0.5) return {
    title: 'Gerimis', icon: 'rainy-outline', iconColor: '#64748b',
    bgColor: '#f8fafc', accentColor: '#64748b',
    desc: 'Hujan ringan atau gerimis. Kondisi jalan mungkin licin, waspada berkendara.',
  };
  if (ku > 80 && rm < 150) return {
    title: 'Mendung', icon: 'cloud', iconColor: '#94a3b8',
    bgColor: '#f8fafc', accentColor: '#94a3b8',
    desc: 'Kelembapan tinggi dan minim sinar matahari. Berpotensi turun hujan sewaktu-waktu.',
  };
  if (rm > 600 && su > 31) return {
    title: 'Panas Terik', icon: 'sunny', iconColor: '#f97316',
    bgColor: '#fff7ed', accentColor: '#f97316',
    desc: 'Suhu dan radiasi matahari sangat tinggi. Waspada dehidrasi dan hindari paparan matahari terlalu lama.',
  };
  if (rm > 300 && su > 27) return {
    title: 'Cerah', icon: 'partly-sunny', iconColor: '#f59e0b',
    bgColor: '#fffbeb', accentColor: '#f59e0b',
    desc: 'Cuaca terang dan hangat. Sangat mendukung untuk operasional dan aktivitas di luar ruangan.',
  };
  return {
    title: 'Cerah Berawan', icon: 'cloudy', iconColor: '#3b82f6',
    bgColor: '#eff6ff', accentColor: '#3b82f6',
    desc: 'Cuaca relatif normal dan nyaman. Ideal untuk berbagai aktivitas umum.',
  };
}

function MetricCard({ icon, label, value, unit, iconColor }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit: string; iconColor: string;
}) {
  return (
    <View style={mc.card}>
      <View style={mc.top}>
        <Text style={mc.label} numberOfLines={1}>{label}</Text>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={mc.valueRow}>
        <Text style={mc.value}>{value}</Text>
        <Text style={mc.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e2e8f0', padding: 14, elevation: 1,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '600', flexShrink: 1, marginRight: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: { color: '#0f172a', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  unit: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
});

export default function InstansiForecastScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [isLoading, setIsLoading] = useState(true);
  const [deviceName, setDeviceName] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('');
  const [sensorValues, setSensorValues] = useState<Record<string, SensorValue>>({});
  const [forecast, setForecast] = useState<ForecastResult>({
    title: 'Menganalisis...', icon: 'cloud-outline', iconColor: '#94a3b8',
    bgColor: '#f8fafc', accentColor: '#94a3b8',
    desc: 'Sedang mengambil data cuaca terkini...',
  });
  const [lastUpdate, setLastUpdate] = useState('');
  const [mqttConnected, setMqttConnected] = useState(false);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const apiData = process.env.EXPO_PUBLIC_API_DATA;
  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN;

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const targetSensors = ['su', 'ku', 'rm', 'cp'];

      const fetchData = async () => {
        const token = await AsyncStorage.getItem('instansi_token');
        const devId = await AsyncStorage.getItem('selected_device_id');
        if (!token || !devId) { router.replace('../'); return; }

        try {
          const [dsRes, cuacaRes] = await Promise.all([
            fetch(`${apiUrl}/api-app/instansi/aws/ds.php?device_id=${devId}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${apiUrl}/api-app/instansi/aws/cuaca.php?device_id=${devId}`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);

          const dsData = await dsRes.json();
          const cuacaData = await cuacaRes.json();

          if (dsData.status && dsData.selected_device_details) {
            const details = dsData.selected_device_details;
            setDeviceName(details.device?.name || devId);
            setDeviceLocation(details.device?.lokasi || '');
            const sensorMap = new Map((details.sensors || []).map((s: any) => [s.code, s]));

            const url = `${apiData}/api/get-data?device_id=${devId}&jenis=su,ku,rm,cp&mode=raw&limit=100`;
            const dataRes = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } });
            const rawData = await dataRes.json();

            let initialVals: Record<string, SensorValue> = {};
            if (rawData.status && rawData.data) {
              rawData.data.forEach((item: any) => {
                const code = item.parameter_name;
                if (targetSensors.includes(code) && !initialVals[code]) {
                  const sInfo = sensorMap.get(code) as any;
                  initialVals[code] = {
                    value: parseFloat(item.value),
                    unit: sInfo?.unit || '',
                    label: sInfo?.label || code.toUpperCase(),
                    recorded_at: item.recorded_at,
                  };
                }
              });
              setSensorValues(initialVals);
              setForecast(computeForecast(initialVals));
              const firstVal = Object.values(initialVals)[0];
              if (firstVal?.recorded_at) setLastUpdate(firstVal.recorded_at);
            }

            if (cuacaData.status) {
              if (mqttClientRef.current) { mqttClientRef.current.end(true); }
              const client = mqtt.connect('wss://karsacerdasinovatif.web.id:8081', {
                clientId: 'aws_inst_fc_' + Math.random().toString(16).substring(2, 10),
                clean: true, reconnectPeriod: 5000,
              });
              client.on('connect', () => {
                setMqttConnected(true);
                cuacaData.mqtt_topics?.forEach((t: string) => client.subscribe(t));
              });
              client.on('disconnect', () => setMqttConnected(false));
              client.on('offline', () => setMqttConnected(false));
              client.on('message', (topic: string, payload: Buffer) => {
                const val = parseFloat(payload.toString());
                let updatedCode = '';
                Object.keys(cuacaData.data || {}).forEach(code => {
                  if (cuacaData.data[code] === topic) updatedCode = code;
                });
                if (updatedCode && targetSensors.includes(updatedCode)) {
                  const now = new Date();
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                  setSensorValues(prev => {
                    const next = { ...prev, [updatedCode]: { value: val, unit: prev[updatedCode]?.unit || '', label: prev[updatedCode]?.label || updatedCode.toUpperCase(), recorded_at: ts } };
                    setTimeout(() => setForecast(computeForecast(next)), 0);
                    setLastUpdate(ts);
                    return next;
                  });
                }
              });
              mqttClientRef.current = client;
            }
          }
        } catch (err) { console.error('Instansi forecast error:', err); }
        finally { setIsLoading(false); }
      };

      fetchData();
      return () => {
        if (mqttClientRef.current) { mqttClientRef.current.end(true); mqttClientRef.current = null; }
      };
    }, [])
  );

  const formatTime = (ts: string) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Estimasi Cuaca Lokal</Text>
          <Text style={styles.headerSub}>Berdasarkan data pantauan riil stasiun AWS</Text>
        </View>
        <View style={[styles.syncBadge, { backgroundColor: mqttConnected ? '#dcfce7' : '#fef9c3' }]}>
          <Animated.View style={[styles.syncDot, {
            backgroundColor: mqttConnected ? '#22c55e' : '#f59e0b',
            transform: [{ scale: pulseAnim }],
          }]} />
          <Text style={[styles.syncText, { color: mqttConnected ? '#166534' : '#854d0e' }]}>
            {mqttConnected ? 'Live' : 'API'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: '#f8fafc' }}>

        {/* Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={20} color="#3b82f6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationName}>{deviceName || 'Memuat...'}</Text>
            <Text style={styles.locationInfo} numberOfLines={1}>{deviceLocation}</Text>
          </View>
        </View>

        {/* Forecast Hero Card */}
        {isLoading ? (
          <View style={styles.forecastCard}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.analyzeText}>Menganalisis pola cuaca...</Text>
          </View>
        ) : (
          <View style={[styles.forecastCard, { backgroundColor: forecast.bgColor, borderColor: forecast.accentColor + '30' }]}>
            <Ionicons name={forecast.icon} size={80} color={forecast.iconColor} />
            <Text style={[styles.forecastTitle, { color: forecast.accentColor }]}>{forecast.title}</Text>
            <Text style={styles.forecastDesc}>{forecast.desc}</Text>
          </View>
        )}

        {/* Metrics */}
        {!isLoading && (
          <>
            <Text style={styles.sectionLabel}>FAKTOR PENENTU</Text>
            <View style={styles.metricsGrid}>
              <MetricCard icon="thermometer" label={sensorValues['su']?.label || 'Suhu Udara'}
                value={sensorValues['su']?.value !== undefined ? sensorValues['su'].value.toFixed(1) : '-'}
                unit={sensorValues['su']?.unit || '°C'} iconColor="#ef4444" />
              <MetricCard icon="water" label={sensorValues['ku']?.label || 'Kelembapan'}
                value={sensorValues['ku']?.value !== undefined ? sensorValues['ku'].value.toFixed(1) : '-'}
                unit={sensorValues['ku']?.unit || '%'} iconColor="#3b82f6" />
              <MetricCard icon="sunny" label={sensorValues['rm']?.label || 'Radiasi Surya'}
                value={sensorValues['rm']?.value !== undefined ? sensorValues['rm'].value.toFixed(0) : '-'}
                unit={sensorValues['rm']?.unit || 'W/m²'} iconColor="#f59e0b" />
              <MetricCard icon="rainy" label={sensorValues['cp']?.label || 'Curah Hujan'}
                value={sensorValues['cp']?.value !== undefined ? sensorValues['cp'].value.toFixed(1) : '-'}
                unit={sensorValues['cp']?.unit || 'mm'} iconColor="#6366f1" />
            </View>
            <Text style={styles.tsText}>Data diambil pada: {formatTime(lastUpdate)}</Text>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 16, gap: 14 },
  locationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 14, elevation: 1,
  },
  locationIcon: { backgroundColor: '#dbeafe', borderRadius: 22, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  locationName: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  locationInfo: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  forecastCard: {
    backgroundColor: '#eff6ff', borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe',
    padding: 28, alignItems: 'center', gap: 12, minHeight: 240, justifyContent: 'center', elevation: 2,
  },
  forecastTitle: { fontSize: 36, fontWeight: '900', letterSpacing: -0.5 },
  forecastDesc: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  analyzeText: { color: '#94a3b8', fontSize: 13, marginTop: 12 },
  sectionLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: -4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tsText: { color: '#cbd5e1', fontSize: 11, textAlign: 'center' },
});
