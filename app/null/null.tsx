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
  Animated,
  Easing,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import mqtt from 'mqtt';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// INTERFACE DEFINITIONS
// ============================================

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

interface DeviceInfo {
  name: string;
  id: string;
  zona_waktu: string;
  lokasi: string;
}

interface ConfigData {
  status: boolean;
  device: DeviceInfo;
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

interface BatteryInfo {
  percent: string;
  voltage: string;
}

// ============================================
// CONSTANTS & DEFAULTS
// ============================================

const DEFAULT_CONFIG: ConfigData = {
  status: false,
  device: { name: '', id: '', zona_waktu: 'WIB', lokasi: 'Memuat...' },
  sensors: [],
  charts: [],
  mqtt_topics: [],
};

const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  status: false,
  device_name: '',
  device_id: '',
  zonawaktu: 'WIB',
  sensors: [],
  years: [],
};

const BATTERY_VOLTAGE = {
  MIN: 10.7,
  MAX: 14.0,
  WARNING_THRESHOLD: 11.5,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

const detectSensorType = (label: string): string => {
  if (!label) return 'general';
  
  const lowerLabel = label.toLowerCase();
  const typeMap: Record<string, string> = {
    'arah': 'wind_dir',
    'kecepatan': 'wind_spd',
    'speed': 'wind_spd',
    'gust': 'wind_gust',
    'hujan': 'rain',
    'rain': 'rain',
    'suhu': 'temp',
    'temp': 'temp',
    'kelembapan': 'hum',
    'hum': 'hum',
    'tekanan': 'press',
    'press': 'press',
    'radiasi': 'solar',
    'solar': 'solar',
    'Radiasi': 'solar',
    'baterai': 'battery',
    'battery': 'battery',
    'batt': 'battery',
    'volt': 'battery',
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerLabel.includes(key)) {
      return value;
    }
  }
  
  return 'general';
};

const timeAgo = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Baru saja';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getSensorIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    temp: 'thermometer',
    hum: 'water',
    rain: 'rainy',
    wind_spd: 'speedometer',
    wind_dir: 'compass',
    solar: 'sunny',
    press: 'speedometer',
    battery: 'battery-charging',
  };
  
  return iconMap[type] || 'analytics';
};

const calculateBatteryInfo = (voltage: number): BatteryInfo => {
  const { MIN, MAX } = BATTERY_VOLTAGE;
  let percent = ((voltage - MIN) / (MAX - MIN)) * 100;
  percent = Math.min(100, Math.max(0, percent));
  
  return {
    percent: percent.toFixed(0),
    voltage: voltage.toFixed(1),
  };
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardScreen() {
  const router = useRouter();

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Connection & UI States
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [lastUpdateTxt, setLastUpdateTxt] = useState<string>('');
  const [lastDataTimestamp, setLastDataTimestamp] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // Configuration States
  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG);
  const [historyConfig, setHistoryConfig] = useState<HistoryConfig>(DEFAULT_HISTORY_CONFIG);
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});

  // Weather Data States
  const [rain1h, setRain1h] = useState<string>('0.0');
  const [rainYest, setRainYest] = useState<string>('0.0');

  // Chart States
  const [selectedSensor, setSelectedSensor] = useState<HistorySensor | null>(null);
  const [timeInterval, setTimeInterval] = useState<string>('hari');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [showSensorModal, setShowSensorModal] = useState<boolean>(false);
  const [showIntervalModal, setShowIntervalModal] = useState<boolean>(false);

  // ============================================
  // REFS
  // ============================================

  const windRotation = useRef(new Animated.Value(0)).current;
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const lastMsgTime = useRef<number>(Date.now());
  const timeAgoInterval = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // ENVIRONMENT VARIABLES
  // ============================================

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  const apiData = process.env.EXPO_PUBLIC_API_DATA || '';
  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN || '';

  // ============================================
  // API FUNCTIONS
  // ============================================

  const fetchConfig = async (): Promise<void> => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      router.replace('/');
      return;
    }

    try {
      const url = `${apiUrl}/api-app/user/aws/ds.php`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.status) {
        const processedSensors: SensorData[] = data.sensors.map((sensor: any) => ({
          ...sensor,
          type: detectSensorType(sensor.label),
        }));

        const newConfig: ConfigData = {
          ...data,
          sensors: processedSensors,
        };

        setConfig(newConfig);

        // Initialize sensor values
        const initialValues: Record<string, number> = {};
        processedSensors.forEach((sensor: SensorData) => {
          initialValues[sensor.topic] = parseFloat(sensor.value.toString());
        });
        setSensorValues(initialValues);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const fetchHistoryConfig = async (): Promise<void> => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) return;

    try {
      const url = `${apiUrl}/api-app/user/aws/history.php`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.status) {
        setHistoryConfig(data);
        if (data.sensors?.length > 0 && !selectedSensor) {
          setSelectedSensor(data.sensors[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load history config:', error);
    }
  };

  const fetchLastKnownData = useCallback(async (): Promise<void> => {
    if (!config?.device?.id) return;

    const url = `${apiData}/api/get-data?device_id=${config.device.id}&periode=now&zonawaktu=${config.device.zona_waktu || 'WIB'}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const json = await response.json();

      if (json.status && json.data?.length > 0) {
        const updates: Record<string, number> = {};
        let newestTimestamp = '';

        json.data.forEach((item: any) => {
          const sensor = config.sensors.find(
            (s) => s.topic.endsWith(item.parameter_name) || s.topic.endsWith(item.mqtt_suffix)
          );

          if (sensor) {
            updates[sensor.topic] = parseFloat(item.value);
            if (!newestTimestamp || new Date(item.recorded_at) > new Date(newestTimestamp)) {
              newestTimestamp = item.recorded_at;
            }
          }
        });

        setSensorValues((prev) => ({ ...prev, ...updates }));

        if (newestTimestamp) {
          setLastDataTimestamp(newestTimestamp);
          setLastUpdateTxt(timeAgo(newestTimestamp));
        }
      }
    } catch (error) {
      console.error('Offline fetch error:', error);
    }
  }, [config, apiData, apiToken]);

  // ============================================
  // EFFECTS
  // ============================================

  // Initial load
  useEffect(() => {
    fetchConfig();
    fetchHistoryConfig();
  }, []);

  // Wind rotation animation
  useEffect(() => {
    if (!windDir) return;

    const targetValue = sensorValues[windDir.topic] || 0;
    Animated.timing(windRotation, {
      toValue: targetValue,
      duration: 1000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [sensorValues[windDir?.topic || '']]);

  // MQTT connection
  useEffect(() => {
    if (!config?.device?.id) return;

    const client = mqtt.connect('wss://karsacerdasinovatif.web.id:8081', {
      clientId: `aws_rn_${Math.random().toString(16).substring(2, 10)}`,
      clean: true,
    });

    client.on('connect', () => {
      setIsConnected(true);
      config.mqtt_topics.forEach((topic) => client.subscribe(topic));
    });

    client.on('message', (topic, payload) => {
      const value = parseFloat(payload.toString());
      setIsConnected(true);
      lastMsgTime.current = Date.now();
      setSensorValues((prev) => ({ ...prev, [topic]: value }));
    });

    client.on('offline', () => {
      setIsConnected(false);
      fetchLastKnownData();
    });

    clientRef.current = client;

    return () => {
      if (client) {
        client.end(true);
      }
    };
  }, [config, fetchLastKnownData]);

  // ============================================
  // MEMOIZED VALUES
  // ============================================

  const sensorsMemo = useMemo(() => {
    const sensors = config?.sensors || [];
    return {
      windDir: sensors.find((item) => item.type === 'wind_dir'),
      battery: sensors.find((item) => item.type === 'battery'),
      mainTemp: sensors.find((item) => item.type === 'temp'),
      humidity: sensors.find((item) => item.type === 'hum'),
      windSpd: sensors.find((item) => item.type === 'wind_spd'),
      solar: sensors.find((item) => item.type === 'solar'),
      pressure: sensors.find((item) => item.type === 'press'),
      rainSensors: sensors.filter((item) => item.type === 'rain'),
    };
  }, [config]);

  const { windDir, battery, mainTemp, humidity, windSpd, solar, pressure, rainSensors } = sensorsMemo;

  // ============================================
  // ANIMATION INTERPOLATION
  // ============================================

  const windRotateInterpolate = windRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['-45deg', '315deg'], // -45deg karena icon navigate aslinya miring
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const getSensorValue = (topic: string): number => {
    return sensorValues[topic] ?? 0;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchConfig(), fetchHistoryConfig()]).finally(() => {
      setRefreshing(false);
    });
  }, []);

  // ============================================
  // RENDER COMPONENTS
  // ============================================

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Ionicons name="planet-outline" size={24} color="#06b6d4" />
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {config.device.lokasi || 'Memuat...'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {config.device.zona_waktu} - {config.device.id}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isConnected ? '#dcfce7' : '#fee2e2' },
          ]}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isConnected ? '#166534' : '#991b1b' },
            ]}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        {!isConnected && lastUpdateTxt && (
          <Text style={styles.lastUpdateText}>{lastUpdateTxt}</Text>
        )}
      </View>
    </View>
  );

  const renderTemperatureHumidityRow = () => (
    <View style={styles.rowContainer}>
      <View style={[styles.tempCard, styles.halfCard, { marginRight: 8 }]}>
        <Ionicons name="thermometer" size={24} color="#06b6d4" />
        <Text style={styles.tempLabel}>Suhu Udara</Text>
        <View style={styles.tempValueContainer}>
          <Text style={styles.tempValue}>
            {mainTemp ? getSensorValue(mainTemp.topic).toFixed(1) : '--.-'}
          </Text>
          <Text style={styles.tempUnit}>°C</Text>
        </View>
      </View>
      <View style={[styles.tempCard, styles.halfCard, { marginLeft: 8 }]}>
        <Ionicons name="water" size={24} color="#06b6d4" />
        <Text style={styles.tempLabel}>Kelembapan</Text>
        <View style={styles.tempValueContainer}>
          <Text style={styles.tempValue}>
            {humidity ? getSensorValue(humidity.topic).toFixed(1) : '--.-'}
          </Text>
          <Text style={styles.tempUnit}>%</Text>
        </View>
      </View>
    </View>
  );

  const renderWindCard = () => {
    const windDirection = windDir ? getSensorValue(windDir.topic) : 0;
    const windSpeed = windSpd ? getSensorValue(windSpd.topic) : 0;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Arah & Kecepatan Angin</Text>
        <View style={styles.windCompassSection}>
          <View style={styles.compass}>
            <Text style={styles.compassN}>N</Text>
            <Animated.View style={{ transform: [{ rotate: windRotateInterpolate }] }}>
              <Ionicons name="navigate" size={48} color="#06b6d4" />
            </Animated.View>
          </View>
          <Text style={styles.compassDegree}>{windDirection.toFixed(0)}°</Text>
        </View>
        <View style={styles.windSpeedSection}>
          <Text style={styles.valueNumberangin}>
            {windSpeed.toFixed(1)}
            <Text style={styles.valueUnit}> m/s</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderBatteryCard = () => {
    const batteryVoltage = battery ? getSensorValue(battery.topic) : 0;
    const batteryInfo = calculateBatteryInfo(batteryVoltage);
    const batteryColor = batteryVoltage < BATTERY_VOLTAGE.WARNING_THRESHOLD ? '#ef4444' : '#22c55e';

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status Daya</Text>
        <View style={styles.batteryRow}>
          <View style={styles.batteryContainer}>
            <View style={styles.batteryBody}>
              <View
                style={[
                  styles.batteryLevel,
                  {
                    width: `${batteryInfo.percent}%`,
                    backgroundColor: batteryColor,
                  },
                ]}
              />
            </View>
            <View style={styles.batteryCap} />
          </View>
          <View style={styles.batteryInfoContainer}>
            <Text style={styles.batteryPercentText}>{batteryInfo.percent}%</Text>
            <Text style={styles.batteryVoltageText}>({batteryInfo.voltage} V)</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderOtherSensorsGrid = () => (
    <View style={styles.rowContainer}>
      <View style={[styles.card, styles.halfCard, { marginRight: 8 }]}>
        <Text style={styles.cardTitle}>Radiasi</Text>
        <Text style={styles.valueNumber}>
          {solar ? getSensorValue(solar.topic).toFixed(0) : '0'}
          <Text style={styles.valueUnit}> W/m²</Text>
        </Text>
      </View>
      <View style={[styles.card, styles.halfCard, { marginLeft: 8 }]}>
        <Text style={styles.cardTitle}>Tekanan</Text>
        <Text style={styles.valueNumber}>
          {pressure ? getSensorValue(pressure.topic).toFixed(0) : '0'}
          <Text style={styles.valueUnit}> hPa</Text>
        </Text>
      </View>
    </View>
  );

  const renderLoadingIndicator = () => (
    <View style={styles.initialLoadingContainer}>
      <ActivityIndicator size="large" color="#06b6d4" />
      <Text style={styles.initialLoadingText}>Memuat data sensor...</Text>
    </View>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {renderHeader()}

      {isInitialLoad && renderLoadingIndicator()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#06b6d4']}
          />
        }>
        {renderTemperatureHumidityRow()}
        {renderWindCard()}
        {renderBatteryCard()}
        {renderOtherSensorsGrid()}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTextContainer: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  lastUpdateText: {
    fontSize: 9,
    color: '#f59e0b',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  rowContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
  },
  tempCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 2,
  },
  tempLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 5,
  },
  tempValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tempValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  tempUnit: {
    fontSize: 14,
    color: '#06b6d4',
    marginLeft: 2,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  windCompassSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  compass: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compassN: {
    position: 'absolute',
    top: 5,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  compassDegree: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  windSpeedSection: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  valueNumberangin: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  valueNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  valueUnit: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: 'normal',
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryBody: {
    width: 50,
    height: 24,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 4,
    padding: 2,
  },
  batteryLevel: {
    height: '100%',
    borderRadius: 1,
  },
  batteryCap: {
    width: 4,
    height: 10,
    backgroundColor: '#334155',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  batteryInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  batteryPercentText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  batteryVoltageText: {
    fontSize: 14,
    color: '#64748b',
  },
  initialLoadingContainer: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  initialLoadingText: {
    marginTop: 10,
    color: '#64748b',
  },
});