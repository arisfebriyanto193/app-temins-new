import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import mqtt from 'mqtt';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native';



const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Interfaces ---
interface SensorData {
  label: string;
  topic: string;
  unit: string;
  value: number;
  type: string;
  lokasi: string;
}

interface HistorySensor {
  code: string;
  label: string;
  unit: string;
  icon: string;
  color: string;
}

interface ConfigData {
  status: boolean;
  device: { name: string; id: string; zona_waktu: string; lokasi: string };
  sensors: SensorData[];
  charts: { val: string; label: string }[];
  mqtt_topics: string[];
}

interface HistoryConfig {
  status: boolean;
  device_name: string;
  device_id: string;
  zonawaktu: string;
  sensors: HistorySensor[];
  years: number[];
}

// --- Default Values ---
const DEFAULT_CONFIG: ConfigData = {
  status: false,
  device: { name: '', id: '', zona_waktu: 'WIB', lokasi: 'Memuat...' },
  sensors: [],
  charts: [],
  mqtt_topics: []
};

const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  status: false,
  device_name: '',
  device_id: '',
  zonawaktu: 'WIB',
  sensors: [],
  years: []
};

// --- Helpers ---
const detectType = (label: string): string => {
  if (!label) return 'general';
  const l = label.toLowerCase();
  if (l.includes('arah')) return 'wind_dir';
  if (l.includes('kecepatan') || l.includes('speed')) return 'wind_spd';
  if (l.includes('gust')) return 'wind_gust';
  if (l.includes('hujan') || l.includes('rain')) return 'rain';
  if (l.includes('suhu') || l.includes('temp')) return 'temp';
  if (l.includes('kelembapan') || l.includes('hum')) return 'hum';
  if (l.includes('tekanan') || l.includes('press')) return 'press';
  if (l.includes('radiasi') || l.includes('solar') || l.includes('Radiasi')) return 'solar';
  if (l.includes('baterai') || l.includes('battery') || l.includes('batt') || l.includes('volt')) return 'battery';
  return 'general';
};

const timeAgo = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Baru saja";
  const interval = Math.floor(seconds / 60);
  if (interval < 60) return interval + " menit lalu";
  const hours = Math.floor(interval / 60);
  if (hours < 24) return hours + " jam lalu";
  return Math.floor(hours / 24) + " hari lalu";
};

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const getIconForSensor = (type: string) => {
  switch(type) {
    case 'temp': return 'thermometer';
    case 'hum': return 'water';
    case 'rain': return 'rainy';
    case 'wind_spd': return 'speedometer';
    case 'wind_dir': return 'compass';
    case 'solar': return 'sunny';
    case 'press': return 'speedometer';
    case 'battery': return 'battery-charging';
    default: return 'analytics';
  }
};

export default function DashboardScreen() {
  const router = useRouter();

  // --- States ---
  const [isConnected, setIsConnected] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lastUpdateTxt, setLastUpdateTxt] = useState("");
  const [lastDataTimestamp, setLastDataTimestamp] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG);
  const [historyConfig, setHistoryConfig] = useState<HistoryConfig>(DEFAULT_HISTORY_CONFIG);
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [rain1h, setRain1h] = useState("0.0");
  const [rainYest, setRainYest] = useState("0.0");

  // Grafik states    
  const [selectedSensor, setSelectedSensor] = useState<HistorySensor | null>(null);
  const [timeInterval, setTimeInterval] = useState("hari");
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);
  const [showIntervalModal, setShowIntervalModal] = useState(false);

  // --- Refs ---
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const lastMsgTime = useRef<number>(Date.now());
  const timeAgoInterval = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const apiData = process.env.EXPO_PUBLIC_API_DATA;
  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN;

  // --- Initial Config Load ---
  const fetchConfig = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      router.replace('/');
      return;
    }

    try {
      const url = `${apiUrl}/api-app/user/aws/ds.php`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.status) {
        const processedSensors = data.sensors.map((s: any) => ({
          ...s,
          type: detectType(s.label)
        }));
        
        const newConfig = { ...data, sensors: processedSensors };
        setConfig(newConfig);

        const initials: Record<string, number> = {};
        processedSensors.forEach((s: SensorData) => {
          initials[s.topic] = parseFloat(s.value.toString());
        });
        setSensorValues(initials);
      }
    } catch (err) {
      console.error("Failed to load config", err);
    } finally {
      setIsInitialLoad(false);
    }
  };

  // --- Fetch History Config ---
  const fetchHistoryConfig = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) return;

    try {
      const url = `${apiUrl}/api-app/user/aws/history.php`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.status) {
        setHistoryConfig(data);
        // Set default selected sensor for chart
        if (data.sensors && data.sensors.length > 0 && !selectedSensor) {
          setSelectedSensor(data.sensors[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load history config", err);
    }
  };

  useEffect(() => {
    // Load initial data
    fetchConfig();
    fetchHistoryConfig();
  }, []);

  // --- Fetch Chart Data ---
  const fetchChartData = useCallback(async () => {
    if (!historyConfig || !selectedSensor || !historyConfig.device_id) return;
    
    setChartLoading(true);
    
    try {
      const deviceId = historyConfig.device_id;
      const sensorCode = selectedSensor.code;
      const zonaWaktu = historyConfig.zonawaktu || 'WIB';
      let url = '';
      
      const now = new Date();
      let startDate = new Date();
      
      switch(timeInterval) {
        case 'hari':
          startDate.setDate(now.getDate() - 1);
          url = `${apiData}/api/get-data?device_id=${deviceId}&jenis=${sensorCode}&periode=hari&mode=ringkas&value=high&zonawaktu=${zonaWaktu}&limit=7`;
          break;
        case 'minggu_ini':
          startDate.setDate(now.getDate() - 7);
          url = `${apiData}/api/get-data?device_id=${deviceId}&jenis=${sensorCode}&periode=minggu_ini&mode=ringkas&value=high&zonawaktu=${zonaWaktu}`;
          break;
        case 'bulan':
          startDate.setMonth(now.getMonth() - 1);
          url = `${apiData}/api/get-data?device_id=${deviceId}&jenis=${sensorCode}&periode=bulan&mode=ringkas&value=high&zonawaktu=${zonaWaktu}&limit=10`;
          break;
        case 'custom':
          startDate = customStartDate;
          const endDate = customEndDate;
          url = `${apiData}/api/get-data?device_id=${deviceId}&jenis=${sensorCode}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&mode=detail&zonawaktu=${zonaWaktu}`;
          break;
        default:
          startDate.setDate(now.getDate() - 1);
          url = `${apiData}/api/get-data?device_id=${deviceId}&jenis=${sensorCode}&periode=hari&mode=detail&value=high&zonawaktu=${zonaWaktu}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      
      const json = await res.json();
      
      if (json.status && json.data && json.data.length > 0) {
        const validData = json.data.filter((d: any) => !isNaN(parseFloat(d.value)));
        
        validData.sort((a: any, b: any) => 
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        
        const labels = validData.map((d: any) => {
          const dt = new Date(d.recorded_at);
          if (timeInterval === 'hari') {
            return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
          } else if (timeInterval === 'minggu_ini') {
            return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
          } else {
            return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          }
        });
        
        const values = validData.map((d: any) => parseFloat(d.value));
        
        setChartLabels(labels);
        setChartData(values);
      } else {
        setChartLabels([]);
        setChartData([]);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartLabels([]);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [historyConfig, selectedSensor, timeInterval, customStartDate, customEndDate, apiData, apiToken]);

  useEffect(() => {
    if (selectedSensor && historyConfig && historyConfig.device_id) {
      fetchChartData();
    }
  }, [selectedSensor, timeInterval, customStartDate, customEndDate, fetchChartData]);

  // --- Fetch Offline Data (Fallback) ---
  const fetchLastKnownData = useCallback(async () => {
    if (!config || !config.device.id) return;
    const zonaWaktu = config.device.zona_waktu || 'WIB';
    const url = `${apiData}/api/get-data?device_id=${config.device.id}&periode=now&zonawaktu=${zonaWaktu}`;
    const token = apiToken;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (json.status && json.data && json.data.length > 0) {
        const dbUpdates: Record<string, number> = {};
        let newestTime = "";

        json.data.forEach((d: any) => {
          const sensor = config.sensors.find(s => {
            const parts = s.topic.split('/');
            const suffix = parts[parts.length - 1];
            return suffix === d.parameter_name || d.mqtt_suffix === suffix;
          });

          if (sensor) {
            dbUpdates[sensor.topic] = parseFloat(d.value);
            if (!newestTime || new Date(d.recorded_at) > new Date(newestTime)) {
              newestTime = d.recorded_at;
            }
          }
        });

        setSensorValues(prev => ({ ...prev, ...dbUpdates }));
        if (newestTime) {
          setLastDataTimestamp(newestTime);
          setLastUpdateTxt(timeAgo(newestTime));
        }
      } else {
        setLastUpdateTxt("Tidak ada data");
      }
    } catch (e) {
      console.error('Offline fetch error:', e);
      setLastUpdateTxt("Error mengambil data");
    }
  }, [config, apiData, apiToken]);

  // --- MQTT Logic ---
  useEffect(() => {
    if (!config || !config.device.id) return;

    const brokerURL = "wss://karsacerdasinovatif.web.id:8081";
    const clientId = "aws_rn_" + Math.random().toString(16).substring(2, 10);

    const client = mqtt.connect(brokerURL, {
      clientId,
      clean: true,
      reconnectPeriod: 5000,
    });

    client.on("connect", () => {
      console.log("MQTT Connected");
      setIsConnected(true);
      setLastUpdateTxt("");
      setLastDataTimestamp("");
      lastMsgTime.current = Date.now();
      
      config.mqtt_topics.forEach((t) => client.subscribe(t));
      client.publish(`temins_iot/${config.device.id}/setting`, "4;1000");
    });

    client.on("message", (topic, payload) => {
      const val = parseFloat(payload.toString());
      lastMsgTime.current = Date.now();
      
      setIsConnected(true);
      setLastUpdateTxt("");
      setLastDataTimestamp("");

      setSensorValues(prev => ({
        ...prev,
        [topic]: val
      }));
    });

    client.on("offline", () => {
      setIsConnected(false);
      fetchLastKnownData();
    });

    client.on("error", (err) => {
      console.error("MQTT Error:", err);
      setIsConnected(false);
      fetchLastKnownData();
    });

    clientRef.current = client;

    const watchdog = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMsg = now - lastMsgTime.current;
      
      if (timeSinceLastMsg > 5000) {
        setIsConnected(prev => {
          if (prev === true) {
            fetchLastKnownData();
            return false;
          }
          return prev;
        });
      }
    }, 5000);

    return () => {
      clearInterval(watchdog);
      if (client) client.end(true);
    };
  }, [config, fetchLastKnownData]);

  // --- Time Ago Auto Updater ---
  useEffect(() => {
    if (!isConnected && lastDataTimestamp) {
      setLastUpdateTxt(timeAgo(lastDataTimestamp));
      timeAgoInterval.current = setInterval(() => {
        setLastUpdateTxt(timeAgo(lastDataTimestamp));
      }, 30000);
    } else {
      if (timeAgoInterval.current) clearInterval(timeAgoInterval.current);
    }
    return () => { if (timeAgoInterval.current) clearInterval(timeAgoInterval.current); };
  }, [isConnected, lastDataTimestamp]);

  // --- Rain Data Fetching ---
  useEffect(() => {
    if (!config || !config.device.id) return;

  const fetchRain = async () => {
    try {
      const API_DATA = apiData
      const API_TOKEN = apiToken

      const url1H = `${API_DATA}/api/get-data?device_id=${config.device.id}&jenis=ch&periode=hari&mode=ringkas`;

      const date = new Date();
      date.setDate(date.getDate() - 1);
      const yStr = date.toISOString().split('T')[0];

      const urlYest = `${API_DATA}/api/get-data?device_id=${config.device.id}&jenis=ch&tanggal=${yStr}&value=high`;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      };

      const [res1h, resYest] = await Promise.all([
        fetch(url1H, { headers }),
        fetch(urlYest, { headers }),
      ]);

      const [json1h, jsonYest] = await Promise.all([
        res1h.json(),
        resYest.json(),
      ]);

      // ===== Hujan 1 Jam =====
      if (json1h?.status && json1h.data?.length > 0) {
        const now = new Date();
        const currentHour = now.getHours();
        const prevHour = currentHour - 1;

        let valCurrent = 0;
        let valPrev = 0;

        json1h.data.forEach((d: any) => {
          const h = new Date(d.recorded_at).getHours();
          if (h === currentHour) valCurrent = parseFloat(d.value);
          if (h === prevHour) valPrev = parseFloat(d.value);
        });

        let diff = valCurrent - valPrev;
        if (diff < 0) diff = 0;

        setRain1h(diff.toFixed(1));
      } else {
        setRain1h('0.0');
      }

      // ===== Hujan Kemarin =====
      if (jsonYest?.status && jsonYest.data?.length > 0) {
        setRainYest(parseFloat(jsonYest.data[0].value).toFixed(1));
      } else {
        setRainYest('0.0');
      }
    } catch (error) {
      console.error('Rain fetch error:', error);
      setRain1h('0.0');
      setRainYest('0.0');
    } finally {
      setIsInitialLoad(false);
    }
  };

  fetchRain();

  }, [config, apiUrl]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchConfig(), fetchHistoryConfig()]).then(() => {
      if (selectedSensor) {
        fetchChartData();
      }
      setRefreshing(false);
    });
  }, [fetchChartData, selectedSensor]);

  const getVal = useCallback((topic: string) => {
    return sensorValues[topic] ?? 0;
  }, [sensorValues]);

  // --- Date Picker Handler ---
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setCustomStartDate(selectedDate);
      } else {
        setCustomEndDate(selectedDate);
      }
    }
  };

  // --- Categorization with fallback ---
  const { mainTemp, humidity, windDir, windSpd, windGust, battery, solar, pressure, leftStack } = useMemo(() => {
    const sensors = config?.sensors || [];
    
    // Create fallback sensors if none exist
    if (sensors.length === 0 && isInitialLoad) {
      const fallbackSensors: SensorData[] = [
        { label: 'Suhu Udara', topic: 'temp_fallback', unit: '°C', value: 0, type: 'temp', lokasi: '' },
        { label: 'Kelembapan', topic: 'hum_fallback', unit: '%', value: 0, type: 'hum', lokasi: '' },
        { label: 'Arah Angin', topic: 'wind_dir_fallback', unit: '°', value: 0, type: 'wind_dir', lokasi: '' },
        { label: 'Kecepatan Angin', topic: 'wind_spd_fallback', unit: 'm/s', value: 0, type: 'wind_spd', lokasi: '' },
        { label: 'Baterai', topic: 'battery_fallback', unit: 'V', value: 0, type: 'battery', lokasi: '' },
        { label: 'Radiasi Matahari', topic: 'solar_fallback', unit: 'W/m²', value: 0, type: 'solar', lokasi: '' },
        { label: 'Tekanan Udara', topic: 'pressure_fallback', unit: 'hPa', value: 0, type: 'press', lokasi: '' },
        { label: 'Curah Hujan', topic: 'rain_fallback', unit: 'mm', value: 0, type: 'rain', lokasi: '' },
      ];
      return {
        mainTemp: fallbackSensors[0],
        humidity: fallbackSensors[1],
        windDir: fallbackSensors[2],
        windSpd: fallbackSensors[3],
        windGust: sensors.find(s => s.type === 'wind_gust'),
        battery: fallbackSensors[4],
        solar: fallbackSensors[5],
        pressure: fallbackSensors[6],
        leftStack: [fallbackSensors[7]],
      };
    }
    
    return {
      mainTemp: sensors.find(s => s.type === 'temp'),
      humidity: sensors.find(s => s.type === 'hum'),
      windDir: sensors.find(s => s.type === 'wind_dir'),
      windSpd: sensors.find(s => s.type === 'wind_spd'),
      windGust: sensors.find(s => s.type === 'wind_gust'),
      battery: sensors.find(s => s.type === 'battery'),
      solar: sensors.find(s => s.type === 'solar'),
      pressure: sensors.find(s => s.type === 'press'),
      leftStack: sensors.filter(s => s.type === 'rain'),
    };
  }, [config, isInitialLoad]);

  const selectedSensorLabel = selectedSensor ? selectedSensor.label : 'Pilih Sensor';


const getBatteryPercent = (v) => {
  const min = 10.8;
  const max = 14.7;
  const percent = ((v - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, percent));
};



return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
   
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="planet-outline" size={24} color="#06b6d4" />
            <View style={styles.headerTextContainer}>
              <Text></Text>
              <Text style={styles.headerTitle}>{config.device.lokasi || 'Memuat...'}</Text>
              <Text style={styles.headerSubtitle}>{config.device.zona_waktu}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
        <View style={[styles.statusBadge, { 
    backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',

  }]}>
    <View style={[
      styles.statusDot,
      { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }
    ]} />
    <Text style={[
      styles.statusText,
      { color: isConnected ? '#166534' : '#991b1b' }
    ]}>
      {isConnected ? 'ONLINE' : 'OFFLINE'}
    </Text>
  </View>

            {!isConnected && lastUpdateTxt && (
              <Text style={styles.lastUpdateText}>{lastUpdateTxt}</Text>
            )}
          </View>
        </View>

      {isInitialLoad ? (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.initialLoadingText}>Memuat data sensor...</Text>
        </View>
      ) : null}

      <ScrollView 
        style={[styles.scrollView, isInitialLoad && styles.hiddenScrollView]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#06b6d4']} />}
      >
        {/* Main Temperature & Humidity */}
        <View style={styles.section}>
          <View style={styles.rowContainer}>
            {mainTemp && (
              <View style={[styles.tempCard, styles.halfCard]}>
                <Ionicons name="thermometer" size={28} color="#06b6d4" />
                <Text style={styles.tempLabel}>Suhu Udara</Text>
                <View style={styles.tempValueContainer}>
                  <Text style={styles.tempValue}>
                    {isInitialLoad ? '--.-' : getVal(mainTemp.topic).toFixed(1)}
                  </Text>
                  <Text style={styles.tempUnit}>{mainTemp.unit}</Text>
                </View>
              </View>
            )}

            {humidity && (
              <View style={[styles.tempCard, styles.halfCard]}>
                <Ionicons name="water" size={28} color="#06b6d4" />
                <Text style={styles.tempLabel}>Kelembapan</Text>
                <View style={styles.tempValueContainer}>
                  <Text style={styles.tempValue}>
                    {isInitialLoad ? '--.-' : getVal(humidity.topic).toFixed(1)}
                  </Text>
                  <Text style={styles.tempUnit}>{humidity.unit}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Wind Direction & Speed - Combined Card */}
        {windDir && windSpd && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Arah Dan Kecepatan Angin</Text>
            
            {/* Kompas - Bagian Atas */}
            <View style={styles.windCompassSection}>
              <View style={styles.compassContainer}>
                <View style={styles.compass}>
                  <Text style={styles.compassN}>N</Text>
                  <View
                    style={[
                      styles.compassArrow,
                      {
                        transform: [
                          {
                            rotate: `${(isInitialLoad ? 0 : getVal(windDir.topic)) - 45}deg`,
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="navigate" size={42} color="#06b6d4" />
                  </View>
                </View>
                <Text style={styles.compassDegree}>
                  {isInitialLoad ? '---' : getVal(windDir.topic)}°
                </Text>
              </View>
            </View>
            
            {/* Kecepatan Angin - Bagian Bawah */}
            <View style={styles.windSpeedSection}>  
              <View style={styles.speedContainer}>
                {/* <Text style={styles.speedLabel}>Kecepatan Angin</Text> */}
                <Text style={styles.valueNumberangin}>
                  {isInitialLoad ? '--.-' : getVal(windSpd.topic)}
                  <Text style={styles.valueUnit}> {windSpd.unit}</Text>
                </Text>
              </View>
            </View>
            
            {/* Loading overlay */}
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#06b6d4" />
              </View>
            )}
          </View>
        )}

        {/* Rain Info */}
        <View style={styles.rowContainer}>
          {/* Other Sensors (Rain) */}
          {leftStack.map(s => (
            <View key={s.topic} style={styles.card}>
              <View style={styles.flexRowBetween}>
                <Text style={styles.cardTitle}>{s.label}</Text>
                <Ionicons name="rainy" size={20} color="#06b6d4" />
              </View>

              <Text style={styles.valueNumber}>
                {isInitialLoad ? '--.-' : getVal(s.topic).toFixed(1)}
                <Text style={styles.valueUnit}> {s.unit}</Text>
              </Text>

              {isInitialLoad && (
                <View style={styles.skeletonOverlay}>
                  <ActivityIndicator size="small" color="#06b6d4" />
                </View>
              )}
            </View>
          ))}

          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.cardTitle}>Hujan Kemarin</Text>
            <Text style={styles.valueNumber}>
              {isInitialLoad ? '--.-' : rainYest} 
              <Text style={styles.valueUnit}> mm</Text>
            </Text>
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#06b6d4" />
              </View>
            )}
          </View>
        </View>

        {/* Solar Radiation & Pressure */}
        <View style={styles.rowContainer}>
          {solar && (
            <View style={[styles.card, styles.halfCard]}>
              <View style={styles.flexRowBetween}>
                <Text style={styles.cardTitle}>Radiasi Matahari</Text>
                <Ionicons name="sunny" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.valueNumber}>
                {isInitialLoad ? '--.-' : getVal(solar.topic).toFixed(1)} 
                <Text style={styles.valueUnit}> {solar.unit}</Text>
              </Text>
              {isInitialLoad && (
                <View style={styles.skeletonOverlay}>
                  <ActivityIndicator size="small" color="#06b6d4" />
                </View>
              )}
            </View>
          )}
          {pressure && (
            <View style={[styles.card, styles.halfCard]}>
              <View style={styles.flexRowBetween}>
                <Text style={styles.cardTitle}>Tekanan Udara</Text>
                <Ionicons name="speedometer" size={20} color="#06b6d4" />
              </View>
              <Text style={styles.valueNumber}>
                {isInitialLoad ? '--.-' : getVal(pressure.topic).toFixed(1)} 
                <Text style={styles.valueUnit}> {pressure.unit}</Text>
              </Text>
              {isInitialLoad && (
                <View style={styles.skeletonOverlay}>
                  <ActivityIndicator size="small" color="#06b6d4" />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Curah Hujan 1 Jam – FULL CARD */}
        <View style={styles.card}>
          <View style={styles.flexRowBetween}>
            <Text style={styles.cardTitle}>Hujan (1 Jam)</Text>
            <Ionicons name="rainy" size={20} color="#06b6d4" />
          </View>

          <Text style={styles.valueNumber}>
            {isInitialLoad ? '--.-' : rain1h}
            <Text style={styles.valueUnit}> mm</Text>
          </Text>

          {isInitialLoad && (
            <View style={styles.skeletonOverlay}>
              <ActivityIndicator size="small" color="#06b6d4" />
            </View>
          )}
        </View>

        {/* Battery & Wind Speed */}
        <View style={styles.rowContainer}>
          {battery && (
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.cardTitle}>Baterai</Text>
              <View style={styles.batteryContainer}>
  <View style={styles.batteryBody}>
    <View
      style={[
        styles.batteryLevel,
        {
          width: isInitialLoad
            ? '50%'
            : `${getBatteryPercent(getVal(battery.topic))}%`,
          backgroundColor: isInitialLoad
            ? '#94a3b8'
            : getVal(battery.topic) < 11.5
              ? '#ef4444'
              : '#22c55e',
        },
      ]}
    />
  </View>

  <View style={styles.batteryCap} />
</View>

              <Text style={styles.valueNumber}>
                {isInitialLoad ? '--.-' : getVal(battery.topic).toFixed(1)}
                <Text style={styles.valueUnit}>V</Text>
              </Text>
              {isInitialLoad && (
                <View style={styles.skeletonOverlay}>
                  <ActivityIndicator size="small" color="#06b6d4" />
                </View>
              )}
            </View>
          )}
          
        </View>

        {/* Enhanced Chart Section */}
        <View style={styles.card}>
          <View style={styles.flexRowBetween}>
            <Text style={styles.cardTitle}>Grafik Data Sensor</Text>
            <Ionicons name="analytics" size={20} color="#06b6d4" />
          </View>
          
          {/* Chart Controls */}
          <View style={styles.chartControls}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowSensorModal(true)}
              disabled={isInitialLoad}
            >
              <Text style={[styles.dropdownButtonText, isInitialLoad && styles.disabledText]} numberOfLines={1}>
                {isInitialLoad ? 'Memuat sensor...' : selectedSensorLabel}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isInitialLoad ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowIntervalModal(true)}
              disabled={isInitialLoad}
            >
              <Text style={[styles.dropdownButtonText, isInitialLoad && styles.disabledText]}>
                {isInitialLoad ? 'Memuat...' : 
                 timeInterval === 'hari' ? 'Hari Ini' : 
                 timeInterval === 'minggu_ini' ? 'Minggu Ini' : 
                 timeInterval === 'bulan' ? 'Bulan Ini' : 'Kustom'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isInitialLoad ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
          </View>

          {/* Custom Date Range (only when timeInterval is 'custom') */}
          {timeInterval === 'custom' && (
            <View style={styles.dateRangeContainer}>
              <TouchableOpacity 
                style={[styles.dateButton, isInitialLoad && styles.disabledButton]}
                onPress={() => {
                  if (isInitialLoad) return;
                  setDatePickerMode('start');
                  setShowDatePicker(true);
                }}
                disabled={isInitialLoad}
              >
                <Ionicons name="calendar" size={16} color={isInitialLoad ? "#94a3b8" : "#06b6d4"} />
                <Text style={[styles.dateButtonText, isInitialLoad && styles.disabledText]}>
                  {customStartDate.toLocaleDateString('id-ID')}
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.dateRangeSeparator}>s/d</Text>
              
              <TouchableOpacity 
                style={[styles.dateButton, isInitialLoad && styles.disabledButton]}
                onPress={() => {
                  if (isInitialLoad) return;
                  setDatePickerMode('end');
                  setShowDatePicker(true);
                }}
                disabled={isInitialLoad}
              >
                <Ionicons name="calendar" size={16} color={isInitialLoad ? "#94a3b8" : "#06b6d4"} />
                <Text style={[styles.dateButtonText, isInitialLoad && styles.disabledText]}>
                  {customEndDate.toLocaleDateString('id-ID')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chart Display */}
          {isInitialLoad ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color="#06b6d4" />
              <Text style={styles.chartLoadingText}>Memuat data grafik...</Text>
            </View>
          ) : chartLoading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color="#06b6d4" />
              <Text style={styles.chartLoadingText}>Memuat data grafik...</Text>
            </View>
          ) : chartData.length > 0 ? (
            <LineChart
              data={{
                labels: chartLabels.filter((_, i) => chartLabels.length <= 24 || i % Math.ceil(chartLabels.length / 12) === 0),
                datasets: [{ 
                  data: chartData,
                  color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                }]
              }}
              width={SCREEN_WIDTH - 64}
              height={220}
              chartConfig={{
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                labelColor: () => '#64748b',
                decimalPlaces: 1,
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#06b6d4'
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: '#f1f5f9'
                }
              }}
              bezier
              style={styles.chart}
              fromZero={selectedSensor?.code === 'ch'}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.noDataText}>Tidak ada data untuk ditampilkan</Text>
            </View>
          )}

          {/* Chart Info */}
          {!isInitialLoad && selectedSensor && chartData.length > 0 && (
            <View style={styles.chartInfo}>
              <Text style={styles.chartInfoText}>
                {selectedSensor.label}: {Math.min(...chartData).toFixed(1)} - {Math.max(...chartData).toFixed(1)} {selectedSensor.unit}
              </Text>
              <Text style={styles.chartInfoSubtext}>
                {chartData.length} data point | 
                {timeInterval === 'hari' ? ' 24 jam terakhir' : 
                 timeInterval === 'minggu_ini' ? ' 7 hari terakhir' : 
                 timeInterval === 'bulan' ? ' 30 hari terakhir' : ' Periode kustom'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sensor Selection Modal */}
      <Modal
        visible={showSensorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSensorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Sensor</Text>
            <ScrollView style={styles.modalScroll}>
              {historyConfig.sensors.map((sensor) => (
                <TouchableOpacity
                  key={sensor.code}
                  style={[
                    styles.modalItem,
                    selectedSensor?.code === sensor.code && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedSensor(sensor);
                    setShowSensorModal(false);
                  }}
                >
                  <View style={styles.modalItemContent}>
                    <Ionicons 
                      name={getIconForSensor(
                        sensor.label.toLowerCase().includes('suhu') ? 'temp' :
                        sensor.label.toLowerCase().includes('kelembapan') ? 'hum' :
                        sensor.label.toLowerCase().includes('hujan') ? 'rain' :
                        sensor.label.toLowerCase().includes('kecepatan') ? 'wind_spd' :
                        sensor.label.toLowerCase().includes('arah') ? 'wind_dir' :
                        sensor.label.toLowerCase().includes('radiasi') ? 'solar' :
                        sensor.label.toLowerCase().includes('tekanan') ? 'press' :
                        sensor.label.toLowerCase().includes('baterai') ? 'battery' : 'general'
                      )}
                      size={20} 
                      color="#06b6d4" 
                    />
                    <View style={styles.modalItemTextContainer}>
                      <Text style={styles.modalItemText}>{sensor.label}</Text>
                      <Text style={styles.modalItemSubtext}>
                        {sensor.unit} | Code: {sensor.code}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSensorModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Interval Selection Modal */}
      <Modal
        visible={showIntervalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIntervalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Interval Waktu</Text>
            <ScrollView style={styles.modalScroll}>
              {[
                { value: 'hari', label: 'Hari Ini', icon: 'today' },
                { value: 'minggu_ini', label: 'Minggu Ini', icon: 'calendar' },
                { value: 'bulan', label: 'Bulan Ini', icon: 'calendar-outline' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalItem,
                    timeInterval === item.value && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setTimeInterval(item.value);
                    setShowIntervalModal(false);
                  }}
                >
                  <View style={styles.modalItemContent}>
                    <Ionicons name={item.icon as any} size={20} color="#06b6d4" />
                    <Text style={styles.modalItemText}>{item.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowIntervalModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? customStartDate : customEndDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <Modal
          visible={showLogoutModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Konfirmasi Keluar</Text>
              <Text style={styles.modalMessage}>Apakah Anda yakin ingin keluar?</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.logoutButton]}
                  onPress={() => {
                    AsyncStorage.removeItem('user_token');
                    router.replace('/');
                  }}
                >
                  <Text style={styles.logoutButtonText}>Keluar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  initialLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  initialLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  hiddenScrollView: {
    opacity: 0.5,
  },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', padding: 16, 
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTextContainer: {},
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },
  headerRight: { alignItems: 'flex-end',  justifyContent: 'center' },
statusBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  gap: 5,
},

  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  lastUpdateText: { fontSize: 9, color: '#f59e0b', marginTop: 2 },
  scrollView: { flex: 1, padding: 16 },
  tempCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    elevation: 2,
    position: 'relative',
  },
  tempLabel: { fontSize: 12, color: '#64748b', marginTop: 5 },
  tempValueContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  tempValue: { fontSize: 40, fontWeight: 'bold', color: '#0f172a' },
  tempUnit: { fontSize: 16, color: '#06b6d4', marginTop: 8 },
  card: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 16, 
    elevation: 1,
    position: 'relative',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Styles untuk wind card
  windCompassSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  windSpeedSection: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  speedLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  halfCard: { flex: 1 },
  valueNumber: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    valueNumberangin: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  valueUnit: { fontSize: 12, color: '#06b6d4' },
  compassContainer: { alignItems: 'center' },
  compass: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    borderWidth: 2, 
    borderColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'relative',
  },
  compassN: { position: 'absolute', top: 5, fontSize: 10, fontWeight: 'bold', color: '#ef4444' },
  compassArrow: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  compassDegree: { marginTop: 10, fontSize: 24, fontWeight: 'bold', alignItems: 'center' },
batteryContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},

batteryBody: {
  width: 48,
  height: 22,
  borderWidth: 2,
  borderColor: '#334155',
  borderRadius: 4,
  padding: 2,
  backgroundColor: '#fff',
},

batteryLevel: {
  height: '100%',
  borderRadius: 2,
},

batteryCap: {
  width: 4,
  height: 10,
  marginLeft: 2,
  borderRadius: 1,
  backgroundColor: '#334155',
},

  batteryFill: { height: '100%' },
  chart: { marginTop: 10, borderRadius: 10 },
  flexRowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  
  // Skeleton Loading
  skeletonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  
  // Chart Styles
  chartControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  disabledText: {
    color: '#94a3b8',
  },
  disabledButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#0f172a',
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold',
  },
  chartLoading: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  chartInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  chartInfoText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  chartInfoSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#06b6d4',
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalItemTextContainer: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});