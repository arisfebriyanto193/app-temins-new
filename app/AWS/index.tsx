import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import mqtt from 'mqtt';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  switch (type) {
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
  type ConnectionStatus = 'WAITING' | 'ONLINE' | 'OFFLINE';
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('WAITING');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lastUpdateTxt, setLastUpdateTxt] = useState("");
  const [lastDataTimestamp, setLastDataTimestamp] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG);
  const [historyConfig, setHistoryConfig] = useState<HistoryConfig>(DEFAULT_HISTORY_CONFIG);
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Keep true initially for config, but we might hide loading earlier

  const [rain1h, setRain1h] = useState("-");
  const [rainYest, setRainYest] = useState("-");
  const [rainRunning, setRainRunning] = useState("-");
  const [rainInterval, setRainInterval] = useState(60); // Default 60 menit

  // --- Display Mode Filter ---
  type CardMode = 'live' | 'high' | 'low';
  const [cardMode, setCardMode] = useState<CardMode>('live');
  const [highVals, setHighVals] = useState<Record<string, number>>({});
  const [lowVals, setLowVals] = useState<Record<string, number>>({});

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
  const [showRainIntervalModal, setShowRainIntervalModal] = useState(false);

  // --- Refs & Animation ---
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const lastMsgTime = useRef<number>(Date.now());
  const longTimeoutDevicesRef = useRef<string[]>([]);
  const timeAgoInterval = useRef<NodeJS.Timeout | number | null>(null);
  const animatedWindDir = useRef(new Animated.Value(0)).current;
  const hasReceivedData = useRef(false);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const apiData = process.env.EXPO_PUBLIC_API_DATA;
  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN;

  // --- Initial Config Load ---
  const fetchConfig = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      router.replace('../');
      return;
    }

    try {
      try {
        const tUrl = `${apiUrl}/api-app/user/timeout.php`;
        const tRes = await fetch(tUrl);
        const tJson = await tRes.json();
        if (tJson.status && Array.isArray(tJson.data)) {
          longTimeoutDevicesRef.current = tJson.data;
        }
      } catch (err) {
        console.error("Timeout err", err);
      }

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
        if (data.sensors && data.sensors.length > 0 && !selectedSensor) {
          setSelectedSensor(data.sensors[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load history config", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchHistoryConfig();
  }, []);

  // --- Smooth Wind Direction Animation ---
  const getVal = useCallback((topic: string): number | undefined => {
    return sensorValues[topic];
  }, [sensorValues]);

  // Cari sensor arah angin untuk animasi
  const windDirSensor = useMemo(() => config?.sensors?.find(s => s.type === 'wind_dir'), [config]);

  // Ref to track the continuous rotation value to avoid spinning incorrectly
  const lastWindDirValue = useRef(0);

  useEffect(() => {
    if (windDirSensor) {
      const currentVal = lastWindDirValue.current;
      const rawVal = getVal(windDirSensor.topic);

      // Only animate if we have a valid value
      if (rawVal !== undefined) {
        const targetVal = rawVal;

        // Calculate shortest path
        let delta = (targetVal - currentVal + 540) % 360 - 180;

        const newVal = currentVal + delta;

        Animated.timing(animatedWindDir, {
          toValue: newVal,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();

        lastWindDirValue.current = newVal;
      }
    }
  }, [sensorValues, windDirSensor]);

  // Interpolasi rotasi (dikurangi 45 derajat sesuai desain awal Anda)
  // We use the raw value because it's now continuous (can be > 360 or < 0)
  const spinCompass = animatedWindDir.interpolate({
    inputRange: [0, 360],
    outputRange: ['-45deg', '315deg'],
    // Important: extrapolate to allow values outside 0-360 range
    extrapolate: 'extend',
  });

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

      switch (timeInterval) {
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

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiToken}` } });
      const json = await res.json();

      if (json.status && json.data && json.data.length > 0) {
        const validData = json.data.filter((d: any) => !isNaN(parseFloat(d.value)));
        validData.sort((a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

        const labels = validData.map((d: any) => {
          const dt = new Date(d.recorded_at);
          if (timeInterval === 'hari') return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
          else if (timeInterval === 'minggu_ini') return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
          else return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        });

        const values = validData.map((d: any) => parseFloat(d.value));
        setChartLabels(labels);
        setChartData(values);
      } else {
        setChartLabels([]);
        setChartData([]);
      }
    } catch (error) {
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

  // --- Fetch Daily High / Low ---
  const fetchDailyHighLow = useCallback(async () => {
    if (!config || !config.device.id) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` };
    const topicToParam = (topic: string) => topic.split('/').pop() || '';
    const allParams = config.sensors.map(s => topicToParam(s.topic));
    try {
      const promises = allParams.flatMap(p => [
        fetch(`${apiData}/api/get-data?device_id=${config.device.id}&jenis=${p}&tanggal=${todayStr}&value=high&mode=raw`, { headers }).then(r => r.json()).then(j => ({ p, mode: 'high', val: j.status && j.data?.length > 0 ? parseFloat(j.data[0].value) : null })),
        fetch(`${apiData}/api/get-data?device_id=${config.device.id}&jenis=${p}&tanggal=${todayStr}&value=low&mode=raw`, { headers }).then(r => r.json()).then(j => ({ p, mode: 'low', val: j.status && j.data?.length > 0 ? parseFloat(j.data[0].value) : null })),
      ]);
      const results = await Promise.all(promises);
      const hv: Record<string, number> = {};
      const lv: Record<string, number> = {};
      results.forEach(({ p, mode, val }) => {
        if (val !== null) {
          const topic = config.sensors.find(s => topicToParam(s.topic) === p)?.topic || p;
          if (mode === 'high') hv[topic] = val;
          else lv[topic] = val;
        }
      });
      setHighVals(hv);
      setLowVals(lv);
    } catch (e) { console.error('daily hl err', e); }
  }, [config, apiData, apiToken]);

  useEffect(() => {
    if (config && config.device.id) {
      fetchDailyHighLow();
      const id = setInterval(fetchDailyHighLow, 10 * 60 * 1000);
      return () => clearInterval(id);
    }
  }, [config, fetchDailyHighLow]);

  // --- Fetch Offline Data (Fallback) ---
  const fetchLastKnownData = useCallback(async () => {
    if (!config || !config.device.id) return;
    const zonaWaktu = config.device.zona_waktu || 'WIB';
    const url = `${apiData}/api/get-data?device_id=${config.device.id}&periode=now&zonawaktu=${zonaWaktu}`;
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
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
            if (!newestTime || new Date(d.recorded_at) > new Date(newestTime)) newestTime = d.recorded_at;
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
      setLastUpdateTxt("Error mengambil data");
    }
  }, [config, apiData, apiToken]);

  // --- MQTT Logic ---
  useEffect(() => {
    if (!config || !config.device.id) return;
    const brokerURL = "wss://karsacerdasinovatif.web.id:8081";
    const clientId = "aws_rn_" + Math.random().toString(16).substring(2, 10);
    const client = mqtt.connect(brokerURL, { clientId, clean: true, reconnectPeriod: 5000 });

    // Reset data flag and set status to WAITING
    hasReceivedData.current = false;
    
    // Check if long timeout
    const isLongTimeout = longTimeoutDevicesRef.current.includes(config.device.id);
    const timeoutDuration = isLongTimeout ? 180000 : 30000; // 3 menit vs 30 detik

    // Initial check: if it's long timeout, we can assume ONLINE directly instead of WAITING
    setConnectionStatus(isLongTimeout ? 'ONLINE' : 'WAITING');
    setLastUpdateTxt(isLongTimeout ? "" : "Menunggu data...");
    if (isLongTimeout) {
      hasReceivedData.current = true; // Act as if we received so it doesn't trip offline rules immediately
      lastMsgTime.current = Date.now();
    }

    // Timeout: Tunggu untuk data MQTT
    const initialTimeout = setTimeout(() => {
      // If we never received data and it's not a long timeout device
      if (!hasReceivedData.current) {
        setConnectionStatus('OFFLINE');
        setLastUpdateTxt("Offline (API Data)");
        fetchLastKnownData();
      }
    }, timeoutDuration);

    client.on("connect", () => {
      // Connected to broker, but not necessarily receiving data yet.
      // We keep WAITING status until data arrives or timeout.
      config.mqtt_topics.forEach((t) => client.subscribe(t));
      client.publish(`temins_iot/${config.device.id}/setting`, "4;1000");
    });

    client.on("message", (topic, payload) => {
      if (!hasReceivedData.current) {
        hasReceivedData.current = true;
        clearTimeout(initialTimeout); // Clear timeout jika data pertama masuk
        setConnectionStatus('ONLINE');
        setLastUpdateTxt("");
        setLastDataTimestamp("");
      }

      // If we were OFFLINE before (maybe reconnected after timeout), switch to ONLINE
      setConnectionStatus(prev => prev !== 'ONLINE' ? 'ONLINE' : prev);

      const val = parseFloat(payload.toString());
      lastMsgTime.current = Date.now();

      setSensorValues(prev => ({ ...prev, [topic]: val }));
    });

    client.on("offline", () => {
      // Only set offline if we are past the waiting period or explicitly offline
      if (hasReceivedData.current) { // If we were online, now offline
        if (!longTimeoutDevicesRef.current.includes(config.device.id)) {
          setConnectionStatus('OFFLINE');
        }
      }
    });

    client.on("error", () => {
      // Similar to offline
      if (hasReceivedData.current) {
        if (!longTimeoutDevicesRef.current.includes(config.device.id)) {
          setConnectionStatus('OFFLINE');
        }
      }
    });

    clientRef.current = client;

    // Watchdog checks if we lost connection after being online
    const watchdog = setInterval(() => {
      const now = Date.now();
      const isLongTimeout = longTimeoutDevicesRef.current.includes(config.device.id);
      const limit = isLongTimeout ? 180000 : 30000;
      
      if (connectionStatus === 'ONLINE' && now - lastMsgTime.current > limit) {
        setConnectionStatus('OFFLINE');
        fetchLastKnownData();
      }
    }, 5000);

    return () => {
      clearInterval(watchdog);
      clearTimeout(initialTimeout);
      if (client) client.end(true);
    };
  }, [config, fetchLastKnownData]); // Removed connectionStatus dependency loop

  // --- Time Ago Auto Updater ---
  useEffect(() => {
    if (connectionStatus === 'OFFLINE' && lastDataTimestamp) {
      setLastUpdateTxt(timeAgo(lastDataTimestamp));
      timeAgoInterval.current = setInterval(() => setLastUpdateTxt(timeAgo(lastDataTimestamp)), 30000);
    } else {
      if (timeAgoInterval.current) clearInterval(timeAgoInterval.current);
    }
    return () => { if (timeAgoInterval.current) clearInterval(timeAgoInterval.current); };
  }, [connectionStatus, lastDataTimestamp]);

  // --- Rain Data ---
  useEffect(() => {
    if (!config || !config.device.id) return;
    const fetchRain = async () => {
      try {
        const url1H = `${apiData}/api/get-data?device_id=${config.device.id}&jenis=cha&periode=hari&limit=2880`;
        const date = new Date();
        date.setDate(date.getDate() - 1);
        const yStr = date.toISOString().split('T')[0];
        const urlYest = `${apiData}/api/get-data?device_id=${config.device.id}&jenis=ch&tanggal=${yStr}&value=high`;
        const zonaWaktu = config.device.zona_waktu || 'WIB';
        const urlRunning = `${apiData}/api/get-data?device_id=${config.device.id}&jenis=cha&periode=hari&zonawaktu=${zonaWaktu}&limit=1`;
        
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` };

        const [res1h, resYest, resRunning] = await Promise.all([
          fetch(url1H, { headers }), 
          fetch(urlYest, { headers }),
          fetch(urlRunning, { headers })
        ]);
        
        const [json1h, jsonYest, jsonRunning] = await Promise.all([
          res1h.json(), 
          resYest.json(),
          resRunning.json()
        ]);

        if (json1h?.status && json1h.data && json1h.data.length > 0) {
          let data = json1h.data.filter((d: any) => !isNaN(parseFloat(d.value)));
          data.sort((a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

          if (data.length > 0) {
            const latestData = data[data.length - 1];
            const latestTime = new Date(latestData.recorded_at).getTime();
            const latestVal = parseFloat(latestData.value);

            const targetTime = latestTime - (rainInterval * 60 * 1000);
            let closestVal = latestVal;
            let minDiff = Infinity;
            
            for (let i = data.length - 1; i >= 0; i--) {
              const currentItemTime = new Date(data[i].recorded_at).getTime();
              const timeDiff = Math.abs(currentItemTime - targetTime);

              if (timeDiff < minDiff) {
                minDiff = timeDiff;
                closestVal = parseFloat(data[i].value);
              }
              if (currentItemTime < targetTime - (20 * 60 * 1000)) break;
            }

            let diff = latestVal - closestVal;
            if (diff < 0) diff = 0;
            setRain1h(diff.toFixed(1));
          } else {
             setRain1h("0.0");
          }
        } else {
          setRain1h('-');
        }

        if (jsonYest?.status && jsonYest.data?.length > 0) {
          setRainYest(parseFloat(jsonYest.data[0].value).toFixed(1));
        } else {
          setRainYest('-');
        }

        if (jsonRunning?.status && jsonRunning.data && jsonRunning.data.length > 0) {
          setRainRunning(parseFloat(jsonRunning.data[0].value).toFixed(1));
        } else {
          setRainRunning('-');
        }
      } catch (error) {
        console.error('Rain fetch error:', error);
        setRain1h('-'); setRainYest('-'); setRainRunning('-');
      }
    };
    fetchRain();
  }, [config, rainInterval]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchConfig(), fetchHistoryConfig()]).then(() => {
      if (selectedSensor) fetchChartData();
      setRefreshing(false);
    });
  }, [fetchChartData, selectedSensor]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'start') setCustomStartDate(selectedDate);
      else setCustomEndDate(selectedDate);
    }
  };

  // --- Logical Sensor Mapping ---
  const { mainTemp, humidity, windDir, windSpd, battery, solar, pressure, leftStack } = useMemo(() => {
    const sensors = config?.sensors || [];
    if (sensors.length === 0 && isInitialLoad) {
      const f = (l: string, t: string, u: string, ty: string) => ({ label: l, topic: t, unit: u, value: 0, type: ty, lokasi: '' });
      return {
        mainTemp: f('Suhu Udara', 't_f', '°C', 'temp'),
        humidity: f('Kelembapan', 'h_f', '%', 'hum'),
        windDir: f('Arah Angin', 'wd_f', '°', 'wind_dir'),
        windSpd: f('Kecepatan Angin', 'ws_f', 'm/s', 'wind_spd'),
        battery: f('Baterai', 'b_f', 'V', 'battery'),
        solar: f('Radiasi Matahari', 's_f', 'W/m²', 'solar'),
        pressure: f('Tekanan Udara', 'p_f', 'hPa', 'press'),
        leftStack: [f('Curah Hujan', 'r_f', 'mm', 'rain')],
      };
    }
    return {
      mainTemp: sensors.find(s => s.type === 'temp'),
      humidity: sensors.find(s => s.type === 'hum'),
      windDir: sensors.find(s => s.type === 'wind_dir'),
      windSpd: sensors.find(s => s.type === 'wind_spd'),
      battery: sensors.find(s => s.type === 'battery'),
      solar: sensors.find(s => s.type === 'solar'),
      pressure: sensors.find(s => s.type === 'press'),
      leftStack: sensors.filter(s => s.type === 'rain'),
    };
  }, [config, isInitialLoad]);

  // --- Battery Helper (10.7V - 14.0V) ---
  const getBatteryPercent = (v: number) => {
    const min = 10.7;
    const max = 14.0;
    const percent = ((v - min) / (max - min)) * 100;
    return Math.min(100, Math.max(0, percent));
  };

  const selectedSensorLabel = selectedSensor ? selectedSensor.label : 'Pilih Sensor';

  // --- Display Value helper ---
  const getDisplayVal = useCallback((topic: string): number | undefined => {
    if (cardMode === 'high') return highVals[topic];
    if (cardMode === 'low') return lowVals[topic];
    return sensorValues[topic];
  }, [cardMode, highVals, lowVals, sensorValues]);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 10 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="planet-outline" size={24} color="#06b6d4" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{config.device.lokasi || 'Memuat...'}</Text>
            <Text style={styles.headerSubtitle}>{config.device.zona_waktu}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, {
            backgroundColor: connectionStatus === 'ONLINE' ? '#dcfce7' :
              connectionStatus === 'WAITING' ? '#fef3c7' : '#fee2e2'
          }]}>
            <View style={[styles.statusDot, {
              backgroundColor: connectionStatus === 'ONLINE' ? '#22c55e' :
                connectionStatus === 'WAITING' ? '#f59e0b' : '#ef4444'
            }]} />
            <Text style={[styles.statusText, {
              color: connectionStatus === 'ONLINE' ? '#166534' :
                connectionStatus === 'WAITING' ? '#b45309' : '#991b1b'
            }]}>
              {connectionStatus === 'ONLINE' ? 'ONLINE' :
                connectionStatus === 'WAITING' ? 'WAITING' : 'OFFLINE'}
            </Text>
          </View>
          {connectionStatus === 'OFFLINE' && lastUpdateTxt && <Text style={styles.lastUpdateText}>{lastUpdateTxt}</Text>}
        </View>
      </View>

      {isInitialLoad && (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.initialLoadingText}>Memuat data sensor...</Text>
        </View>
      )}

      {/* ── Filter Bar ── */}
      <View style={styles.filterBar}>
        {([['live', 'Live'], ['high', 'Tertinggi Hari Ini'], ['low', 'Terendah Hari Ini']] as [CardMode, string][]).map(([mode, label]) => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterPill, cardMode === mode && styles.filterPillActive]}
            onPress={() => setCardMode(mode)}
          >
            <Text style={[styles.filterPillText, cardMode === mode && styles.filterPillTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={[styles.scrollView, isInitialLoad && styles.hiddenScrollView]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#06b6d4']} />}
      >
        {/* Row 1: Temp & Humidity */}
        <View style={styles.section}>
          <View style={styles.rowContainer}>
            {mainTemp && (
              <View style={[styles.tempCard, styles.halfCard, { marginRight: 8 }]}>
                <Ionicons name="thermometer" size={28} color="#06b6d4" />
                <Text style={styles.tempLabel}>Suhu Udara</Text>
                <View style={styles.tempValueContainer}>
                  <Text style={styles.tempValue}>
                    {isInitialLoad || getDisplayVal(mainTemp.topic) === undefined ? '-' : getDisplayVal(mainTemp.topic)!.toFixed(1)}
                  </Text>
                  <Text style={styles.tempUnit}>{mainTemp.unit}</Text>
                </View>
              </View>
            )}
            {humidity && (
              <View style={[styles.tempCard, styles.halfCard, { marginLeft: 8 }]}>
                <Ionicons name="water" size={28} color="#06b6d4" />
                <Text style={styles.tempLabel}>Kelembapan</Text>
                <View style={styles.tempValueContainer}>
                  <Text style={styles.tempValue}>
                    {isInitialLoad || getDisplayVal(humidity.topic) === undefined ? '-' : getDisplayVal(humidity.topic)!.toFixed(1)}
                  </Text>
                  <Text style={styles.tempUnit}>{humidity.unit}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Card: Wind (Animated) */}
        {windDir && windSpd && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Arah Dan Kecepatan Angin</Text>
            <View style={styles.windCompassSection}>
              <View style={styles.compassContainer}>
                <View style={styles.compass}>
                  <Text style={styles.compassN}>N</Text>
                  <Text style={styles.compassE}>E</Text>
                  <Text style={styles.compassS}>S</Text>
                  <Text style={styles.compassW}>W</Text>
                  <Animated.View style={[styles.compassArrow, { transform: [{ rotate: spinCompass }] }]}>
                    <Ionicons name="navigate" size={42} color="#06b6d4" />
                  </Animated.View>
                </View>
                <Text style={styles.compassDegree}>
                  {isInitialLoad || getDisplayVal(windDir.topic) === undefined ? '-' : getDisplayVal(windDir.topic)}°
                </Text>
              </View>
            </View>
            <View style={styles.windSpeedSection}>
              <View style={styles.speedContainer}>
                <Text style={styles.valueNumberangin}>
                  {isInitialLoad || getDisplayVal(windSpd.topic) === undefined ? '-' : getDisplayVal(windSpd.topic)}
                  <Text style={styles.valueUnit}> {windSpd.unit}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Row: Rain Realtime & Yesterday */}
        <View style={styles.rowContainer}>
          <View style={[styles.card, styles.halfCard, { marginRight: 8 }]}>
            <View style={styles.flexRowBetween}>
               <Text style={styles.cardTitle}>Curah Hujan Berjalan</Text>
               <Ionicons name="rainy" size={18} color="#06b6d4" />
            </View>
            <Text style={styles.valueNumber}>
               {isInitialLoad ? '-' : rainRunning}
               <Text style={styles.valueUnit}> mm</Text>
            </Text>
          </View>
          <View style={[styles.card, styles.halfCard, { marginLeft: 8 }]}>
            <Text style={styles.cardTitle}>Hujan Kemarin</Text>
            <Text style={styles.valueNumber}>{isInitialLoad ? '-' : rainYest}<Text style={styles.valueUnit}> mm</Text></Text>
          </View>
        </View>

        {/* Row: Solar & Pressure */}
        <View style={styles.rowContainer}>
          {solar && (
            <View style={[styles.card, styles.halfCard, { marginRight: 8 }]}>
              <View style={styles.flexRowBetween}>
                <Text style={styles.cardTitle}>Radiasi Matahari</Text>
                <Ionicons name="sunny" size={18} color="#f59e0b" />
              </View>
              <Text style={styles.valueNumber}>
                {isInitialLoad || getDisplayVal(solar.topic) === undefined ? '-' : getDisplayVal(solar.topic)!.toFixed(0)}
                <Text style={styles.valueUnit}> {solar.unit}</Text>
              </Text>
            </View>
          )}
          {pressure && (
            <View style={[styles.card, styles.halfCard, { marginLeft: 8 }]}>
              <View style={styles.flexRowBetween}>
                <Text style={styles.cardTitle}>Tekanan Udara</Text>
                <Ionicons name="speedometer" size={18} color="#06b6d4" />
              </View>
              <Text style={styles.valueNumber}>
                {isInitialLoad || getDisplayVal(pressure.topic) === undefined ? '-' : getDisplayVal(pressure.topic)!.toFixed(1)}
                <Text style={styles.valueUnit}> {pressure.unit}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Full Card: Rain Interval */}
        <View style={styles.card}>
          <View style={styles.flexRowBetween}>
             <Text style={styles.cardTitle}>Hujan ({rainInterval} Menit Terakhir)</Text>
             <TouchableOpacity style={styles.intervalButton} onPress={() => setShowRainIntervalModal(true)} disabled={isInitialLoad}>
                 <Text style={[styles.dropdownButtonText, isInitialLoad && styles.disabledText]}>{rainInterval} Menit</Text>
                 <Ionicons name="chevron-down" size={16} color="#06b6d4" />
             </TouchableOpacity>
          </View>
          <Text style={[styles.valueNumber, { marginTop: 10 }]}>{isInitialLoad ? '-' : rain1h}<Text style={styles.valueUnit}> mm</Text></Text>
        </View>

        {/* Card: Battery with Presentation Logic */}
        {
          battery && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status Baterai</Text>
              <View style={styles.batteryDisplayRow}>
                <View style={styles.batteryContainer}>
                  <View style={styles.batteryBody}>
                    <View
                      style={[
                        styles.batteryLevel,
                        {
                          width: `${isInitialLoad || getVal(battery.topic) === undefined ? 0 : getBatteryPercent(getVal(battery.topic)!)}%`,
                          backgroundColor: (getVal(battery.topic) ?? 0) < 11.5 ? '#ef4444' : '#22c55e'
                        }
                      ]}
                    />
                  </View>
                  <View style={styles.batteryCap} />
                </View>
                <Text style={styles.batteryTextInfo}>
                  {isInitialLoad || getVal(battery.topic) === undefined
                    ? '-'
                    : `${getBatteryPercent(getVal(battery.topic)!).toFixed(0)}% (${getVal(battery.topic)!.toFixed(1)} V)`}
                </Text>
              </View>
            </View>
          )
        }

        {/* Chart Section */}
        <View style={styles.card}>
          <View style={styles.flexRowBetween}>
            <Text style={styles.cardTitle}>Grafik Data Sensor</Text>
            <Ionicons name="analytics" size={20} color="#06b6d4" />
          </View>
          <View style={styles.chartControls}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowSensorModal(true)} disabled={isInitialLoad}>
              <Text style={[styles.dropdownButtonText, isInitialLoad && styles.disabledText]} numberOfLines={1}>{isInitialLoad ? '...' : selectedSensorLabel}</Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowIntervalModal(true)} disabled={isInitialLoad}>
              <Text style={styles.dropdownButtonText}>{timeInterval === 'hari' ? 'Hari Ini' : timeInterval === 'minggu_ini' ? 'Minggu Ini' : 'Bulan Ini'}</Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          {chartLoading ? (
            <View style={styles.chartLoading}><ActivityIndicator color="#06b6d4" /></View>
          ) : chartData.length > 0 ? (
            <LineChart
              data={{
                labels: chartLabels.filter((_, i) => chartLabels.length <= 10 || i % Math.ceil(chartLabels.length / 6) === 0),
                datasets: [{ data: chartData, color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})` }]
              }}
              width={SCREEN_WIDTH - 64}
              height={200}
              chartConfig={{
                backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
                color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                labelColor: () => '#64748b', decimalPlaces: 1,
                propsForDots: { r: '3', strokeWidth: '2', stroke: '#06b6d4' }
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.noDataContainer}><Text style={styles.noDataText}>Tidak ada data</Text></View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView >

      {/* Sensor Modal */}
      < Modal visible={showSensorModal} transparent animationType="slide" >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Sensor</Text>
            <ScrollView style={styles.modalScroll}>
              {historyConfig.sensors.map((s) => (
                <TouchableOpacity key={s.code} style={styles.modalItem} onPress={() => { setSelectedSensor(s); setShowSensorModal(false); }}>
                  <Text style={styles.modalItemText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSensorModal(false)}><Text style={styles.modalCloseButtonText}>Tutup</Text></TouchableOpacity>
          </View>
        </View>
      </Modal >

      {/* Interval Modal */}
      < Modal visible={showIntervalModal} transparent animationType="slide" >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Interval</Text>
            {['hari', 'minggu_ini', 'bulan'].map((item) => (
              <TouchableOpacity key={item} style={styles.modalItem} onPress={() => { setTimeInterval(item); setShowIntervalModal(false); }}>
                <Text style={styles.modalItemText}>{item === 'hari' ? 'Hari Ini' : item === 'minggu_ini' ? 'Minggu Ini' : 'Bulan Ini'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowIntervalModal(false)}><Text style={styles.modalCloseButtonText}>Tutup</Text></TouchableOpacity>
          </View>
        </View>
      </Modal >

      {/* Rain Interval Modal */}
      < Modal visible={showRainIntervalModal} transparent animationType="slide" >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Interval Hujan</Text>
            {[5, 10, 15, 30, 60].map((item) => (
              <TouchableOpacity key={item} style={styles.modalItem} onPress={() => { setRainInterval(item); setShowRainIntervalModal(false); }}>
                <Text style={styles.modalItemText}>{item} Menit</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowRainIntervalModal(false)}><Text style={styles.modalCloseButtonText}>Tutup</Text></TouchableOpacity>
          </View>
        </View>
      </Modal >
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTextContainer: {},
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  lastUpdateText: { fontSize: 9, color: '#f59e0b', marginTop: 2 },
  scrollView: { flex: 1, padding: 16 },
  section: { marginBottom: 16 },
  rowContainer: { flexDirection: 'row', marginBottom: 16 },
  halfCard: { flex: 1 },
  tempCard: { backgroundColor: '#fff', padding: 16, borderRadius: 20, alignItems: 'center', elevation: 2 },
  tempLabel: { fontSize: 12, color: '#64748b', marginTop: 5 },
  tempValueContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  tempValue: { fontSize: 32, fontWeight: 'bold', color: '#0f172a' },
  tempUnit: { fontSize: 14, color: '#06b6d4', marginTop: 6, marginLeft: 2 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, elevation: 1 },
  cardTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 12, textTransform: 'uppercase' },
  valueNumber: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  valueNumberangin: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  valueUnit: { textAlign: 'center', fontSize: 12, color: '#06b6d4' },
  windCompassSection: { alignItems: 'center', paddingVertical: 10 },
  compass: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  compassN: { position: 'absolute', top: 5, fontSize: 10, fontWeight: 'bold', color: '#ef4444' },
  compassE: { position: 'absolute', right: 5, fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  compassS: { position: 'absolute', bottom: 5, fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  compassW: { position: 'absolute', left: 5, fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  compassArrow: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  compassDegree: { textAlign: 'center', marginTop: 8, fontSize: 20, fontWeight: 'bold' },
  windSpeedSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  batteryDisplayRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  batteryContainer: { flexDirection: 'row', alignItems: 'center' },
  batteryBody: { width: 50, height: 24, borderWidth: 2, borderColor: '#334155', borderRadius: 4, padding: 2 },
  batteryLevel: { height: '100%', borderRadius: 1 },
  batteryCap: { width: 4, height: 10, backgroundColor: '#334155', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  batteryTextInfo: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  chartControls: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  dropdownButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  dropdownButtonText: { fontSize: 13, color: '#0f172a' },
  disabledText: { color: '#cbd5e1' },
  chart: { marginTop: 10, borderRadius: 10 },
  chartLoading: { height: 150, justifyContent: 'center', alignItems: 'center' },
  noDataContainer: { height: 100, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#94a3b8' },
  intervalButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f9ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 16 },
  modalCloseButton: { marginTop: 15, backgroundColor: '#06b6d4', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalCloseButtonText: { color: '#fff', fontWeight: 'bold' },
  modalScroll: { maxHeight: 300 },
  initialLoadingContainer: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', zIndex: 999 },
  initialLoadingText: { marginTop: 10, color: '#64748b' },
  flexRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compassContainer: { alignItems: 'center' },
  speedContainer: { alignItems: 'center' },
  hiddenScrollView: { display: 'none' },
});