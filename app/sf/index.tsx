import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Buffer } from 'buffer';
import mqtt from 'mqtt';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

// Polyfill untuk MQTT di React Native
global.Buffer = Buffer;

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- Helper Functions ---
const timeAgo = (dateString) => {
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

// --- Default Data Structures ---
const DEFAULT_DATA = {
  device: {
    id: '',
    name: 'Smart Farm',
    lokasi: 'Memuat...',
    zonawaktu: 'WIB'
  },
  sensors: {
    soil_moist: { topic: 'soil_moist_fallback', value: '0', unit: '%' },
    soil_temp: { topic: 'soil_temp_fallback', value: '0', unit: '°C' },
    soil_ph: { topic: 'soil_ph_fallback', value: '0', unit: 'pH' },
    battery: { topic: 'battery_fallback', value: '0', unit: 'V' },
    npk: [],
    chem: []
  },
  mqtt: {
    broker: '',
    topics: []
  },
  charts: []
};

export default function SmartFarmDashboard() {
  // --- States ---
  const [data, setData] = useState(DEFAULT_DATA);
  const [liveValues, setLiveValues] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [lastUpdateTxt, setLastUpdateTxt] = useState("");
  const [lastDataTimestamp, setLastDataTimestamp] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Chart States
  const [selectedChart, setSelectedChart] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("hari");
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);

  // Refs
  const lastMsgTime = useRef(Date.now());
  const clientRef = useRef(null);

  // API Config (Sesuaikan dengan .env Anda)
  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}`;
  const API_DATA_URL = `${process.env.EXPO_PUBLIC_API_DATA}`;
  const API_TOKEN = `${process.env.EXPO_PUBLIC_API_TOKEN}`;

  // --- 1. FETCH CONFIG & INITIAL DATA ---
  const fetchConfig = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      const response = await fetch(`${API_URL}/api-app/user/sf/ds.php`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json();

      if (json.status) {
        setData(json);

        // Initialize live values from sensor data
        const initialMap = {};
        const mapVal = (s) => {
          if (s) {
            const value = parseFloat(s.value);
            initialMap[s.topic] = isNaN(value) ? 0 : value;
          }
        };

        mapVal(json.sensors.soil_moist);
        mapVal(json.sensors.soil_temp);
        mapVal(json.sensors.soil_ph);
        mapVal(json.sensors.battery);

        // Initialize NPK and CHEM sensors
        if (json.sensors.npk) {
          json.sensors.npk.forEach(s => mapVal(s));
        }

        if (json.sensors.chem) {
          json.sensors.chem.forEach(s => mapVal(s));
        }

        setLiveValues(initialMap);

        // Set initial chart selection if available
        if (json.charts && json.charts.length > 0) {
          setSelectedChart(json.charts[0].val);
        }
      }
    } catch (err) {
      console.error('Fetch Config Error:', err);
    } finally {
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // --- 2. FALLBACK API LOGIC ---
  const fetchLastKnownData = useCallback(async () => {
    if (!data || !data.device.id) return;

    const url = `${API_DATA_URL}/api/get-data?device_id=${data.device.id}&periode=now&zonawaktu=${data.device.zonawaktu}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const json = await res.json();

      if (json.status && json.data) {
        const dbUpdates = {};
        let newestTime = "";

        // Collect all sensors
        const allSensors = [
          data.sensors.soil_moist,
          data.sensors.soil_temp,
          data.sensors.soil_ph,
          data.sensors.battery,
          ...(data.sensors.npk || []),
          ...(data.sensors.chem || [])
        ].filter(Boolean);

        json.data.forEach(d => {
          const sensor = allSensors.find(s => {
            if (!s || !s.topic) return false;
            const topicParts = s.topic.split('/');
            const topicSuffix = topicParts[topicParts.length - 1];
            return topicSuffix === d.parameter_name;
          });

          if (sensor) {
            const value = parseFloat(d.value);
            if (!isNaN(value)) {
              dbUpdates[sensor.topic] = value;
              if (!newestTime || d.recorded_at > newestTime) newestTime = d.recorded_at;
            }
          }
        });

        setLiveValues(prev => ({ ...prev, ...dbUpdates }));

        if (newestTime) {
          setLastDataTimestamp(newestTime);
          setLastUpdateTxt(timeAgo(newestTime));
        }
      }
    } catch (e) {
      console.error("Fallback Error", e);
    }
  }, [data]);

  // --- 3. MQTT CONNECTION ---
  useEffect(() => {
    if (!data || !data.mqtt || !data.mqtt.broker) return;

    let isConnectedMqtt = false;
    const client = mqtt.connect(data.mqtt.broker, {
      clientId: "sf_rn_" + Math.random().toString(16).substring(2, 8),
      reconnectPeriod: 5000,
      connectTimeout: 3000,
    });

    client.on("connect", () => {
      isConnectedMqtt = true;
      setConnectionStatus("ONLINE");
      setLastUpdateTxt("");
      if (data.mqtt.topics) {
        data.mqtt.topics.forEach(t => client.subscribe(t));
      }
    });

    client.on("message", (topic, payload) => {
      const val = parseFloat(payload.toString());
      if (!isNaN(val)) {
        lastMsgTime.current = Date.now();
        setConnectionStatus("ONLINE");
        setLiveValues(prev => ({ ...prev, [topic]: val }));
      }
    });

    client.on("close", () => {
      setConnectionStatus("OFFLINE");
      fetchLastKnownData();
    });

    // Watchdog logic
    const watchdog = setInterval(() => {
      if (Date.now() - lastMsgTime.current > 5000) {
        setConnectionStatus("OFFLINE");
        fetchLastKnownData();
      }
    }, 5000);

    clientRef.current = client;

    return () => {
      clearInterval(watchdog);
      client.end(true);
    };
  }, [data, fetchLastKnownData]);

  // --- 4. CHART DATA FETCHING ---
  useEffect(() => {
    if (!selectedChart || !data || !data.device.id || isInitialLoad) return;

    setLoadingChart(true);

    const url = `${API_DATA_URL}/api/get-data?device_id=${data.device.id}&jenis=${selectedChart}&periode=${selectedPeriod}&limit=8&mode=ringkas&zonawaktu=${data.device.zonawaktu}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    })
      .then(res => res.json())
      .then(json => {
        if (json?.status && Array.isArray(json.data) && json.data.length > 0) {
          // Take last 10 data points for better visualization
          const sampled = json.data.slice(-10);

          setChartData({
            labels: sampled.map(d => {
              const dt = new Date(d.recorded_at);
              return `${dt.getHours()}:${dt.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: [
              { data: sampled.map(d => parseFloat(d.value)) }
            ]
          });
        } else {
          setChartData(null);
        }
      })
      .catch(err => {
        console.error("Chart Error", err);
        setChartData(null);
      })
      .finally(() => setLoadingChart(false));

  }, [selectedChart, selectedPeriod, data, isInitialLoad]);

  // --- Helper Functions ---
  const getVal = (sensor) => {
    if (!sensor || !sensor.topic) return 0;
    return liveValues[sensor.topic] !== undefined
      ? liveValues[sensor.topic]
      : (sensor.value ? parseFloat(sensor.value) : 0);
  };

  const getBattPct = (volt) => {
    const minV = 10.8, maxV = 14.7;
    let pct = ((volt - minV) / (maxV - minV)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };

  // Calculate values for display
  const soilMoist = getVal(data.sensors.soil_moist);
  const soilTemp = getVal(data.sensors.soil_temp);
  const soilPh = getVal(data.sensors.soil_ph);
  const battVal = getVal(data.sensors.battery);
  const battPct = getBattPct(battVal);

  // Combine NPK and CHEM sensors for display
  const allNutrientSensors = useMemo(() => {
    return [...(data.sensors.npk || []), ...(data.sensors.chem || [])];
  }, [data]);

  // Chart configuration
  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#ffffff",
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: "#f1f5f9",
    },
    fillShadowGradient: "#10b981",
    fillShadowGradientOpacity: 0.2,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Initial Loading Overlay */}
      {isInitialLoad && (
        <View style={styles.initialLoadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.initialLoadingText}>Memuat data Smart Farm...</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Smart Farm</Text>
          <Text style={styles.headerSubtitle}>
            {data.device.lokasi} • {data.device.zonawaktu}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot,
            {
              backgroundColor: connectionStatus === 'ONLINE' ? '#10b981' :
                connectionStatus === 'CONNECTING' ? '#f59e0b' : '#ef4444'
            }
          ]} />
          <Text style={[
            styles.statusText,
            {
              color: connectionStatus === 'ONLINE' ? '#10b981' :
                connectionStatus === 'CONNECTING' ? '#f59e0b' : '#ef4444'
            }
          ]}>
            {connectionStatus}
          </Text>
          {connectionStatus === 'OFFLINE' && lastUpdateTxt && (
            <Text style={styles.syncText}>{lastUpdateTxt}</Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={isInitialLoad ? { opacity: 0.7 } : {}}
      >

        {/* TOP SENSOR GRID */}
        <View style={styles.grid}>
          {/* Kelembapan */}
          <View style={[styles.card, isInitialLoad && styles.disabledCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.label}>Kelembapan</Text>
              <MaterialCommunityIcons
                name="water-percent"
                size={24}
                color={isInitialLoad ? "#94a3b8" : "#0ea5e9"}
              />
            </View>
            <Text style={[
              styles.valBig,
              { color: isInitialLoad ? "#94a3b8" : '#0ea5e9' }
            ]}>
              {isInitialLoad ? '--' : soilMoist.toFixed(0)}%
            </Text>
            <View style={styles.progressBg}>
              <View style={[
                styles.progressFill,
                {
                  width: isInitialLoad ? '50%' : `${Math.min(100, soilMoist)}%`,
                  backgroundColor: isInitialLoad ? "#94a3b8" : '#0ea5e9'
                }
              ]} />
            </View>
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            )}
          </View>

          {/* Suhu */}
          <View style={[styles.card, isInitialLoad && styles.disabledCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.label}>Suhu Tanah</Text>
              <MaterialCommunityIcons
                name="thermometer"
                size={24}
                color={isInitialLoad ? "#94a3b8" : "#f59e0b"}
              />
            </View>
            <Text style={[
              styles.valBig,
              { color: isInitialLoad ? "#94a3b8" : '#f59e0b' }
            ]}>
              {isInitialLoad ? '--.-' : soilTemp.toFixed(1)}°C
            </Text>
            <View style={styles.progressBg}>
              <View style={[
                styles.progressFill,
                {
                  width: isInitialLoad ? '30%' : `${Math.min(100, (soilTemp / 50) * 100)}%`,
                  backgroundColor: isInitialLoad ? "#94a3b8" : '#f59e0b'
                }
              ]} />
            </View>
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.grid}>
          {/* pH Tanah */}
          <View style={[styles.card, isInitialLoad && styles.disabledCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.label}>pH Tanah</Text>
              <MaterialCommunityIcons
                name="flask-outline"
                size={24}
                color={isInitialLoad ? "#94a3b8" : "#8b5cf6"}
              />
            </View>
            <Text style={[
              styles.valBig,
              { color: isInitialLoad ? "#94a3b8" : '#8b5cf6' }
            ]}>
              {isInitialLoad ? '--.-' : soilPh.toFixed(1)}
            </Text>
            <Text style={styles.subLabel}>Tingkat Keasaman</Text>
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            )}
          </View>

          {/* Baterai */}
          <View style={[styles.card, isInitialLoad && styles.disabledCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.label}>Baterai</Text>
              <MaterialCommunityIcons
                name={battPct < 20 ? "battery-alert" : "battery-high"}
                size={24}
                color={isInitialLoad ? "#94a3b8" : (battPct < 20 ? "#ef4444" : "#10b981")}
              />
            </View>
            <Text style={[
              styles.valBig,
              { color: isInitialLoad ? "#94a3b8" : (battPct < 20 ? "#ef4444" : "#10b981") }
            ]}>
              {isInitialLoad ? '--' : battPct}%
            </Text>
            <Text style={styles.subLabel}>
              {isInitialLoad ? '--.- Volt' : `${battVal.toFixed(1)} Volt`}
            </Text>
            {isInitialLoad && (
              <View style={styles.skeletonOverlay}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            )}
          </View>
        </View>

        {/* GROUP NUTRISI TANAH (NPK & CHEM) */}
        <Text style={styles.sectionTitle}>Nutrisi Tanah & Kimia</Text>
        <View style={styles.gridWrapper}>
          {isInitialLoad ? (
            // Show skeleton for nutrients during initial load
            [...Array(4)].map((_, index) => (
              <View key={index} style={[styles.gridItem, styles.disabledCard]}>
                <View style={[styles.listIcon, { backgroundColor: '#f1f5f9' }]}>
                  <Ionicons name="leaf" size={30} color="#cbd5e1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listLabel, { color: '#cbd5e1' }]}>Memuat...</Text>
                  <Text style={[styles.listVal, { color: '#cbd5e1' }]}>
                    -- <Text style={[styles.listUnit, { color: '#cbd5e1' }]}>ppm</Text>
                  </Text>
                </View>
                <View style={styles.skeletonOverlay}>
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              </View>
            ))
          ) : allNutrientSensors.length > 0 ? (
            allNutrientSensors.map((n) => (
              <View key={n.id || n.topic} style={styles.gridItem}>
                <View style={styles.listIcon}>
                  <Ionicons name="leaf" size={30} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLabel} numberOfLines={1}>
                    {n.name || n.label || 'Sensor'}
                  </Text>
                  <Text style={styles.listVal}>
                    {getVal(n).toFixed(1)} <Text style={styles.listUnit}>{n.unit || 'ppm'}</Text>
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="leaf-off" size={40} color="#cbd5e1" />
              <Text style={styles.noDataText}>Tidak ada sensor nutrisi</Text>
            </View>
          )}
        </View>

        {/* CHART SECTION */}
        <View style={[styles.chartCard, isInitialLoad && styles.disabledCard]}>
          <View style={styles.chartHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={20}
                color={isInitialLoad ? "#94a3b8" : "#1e293b"}
              />
              <Text style={[
                styles.cardTitle,
                { color: isInitialLoad ? "#94a3b8" : "#1e293b" }
              ]}>
                Analitik Grafik
              </Text>
            </View>
          </View>

          <View style={styles.pickerRow}>
            <View style={[styles.pickerWrapper, isInitialLoad && styles.disabledPicker]}>
              <MaterialCommunityIcons
                name="database-search"
                size={16}
                color={isInitialLoad ? "#cbd5e1" : "#64748b"}
                style={styles.pickerIcon}
              />
              <Picker
                selectedValue={selectedChart}
                onValueChange={(itemValue) => setSelectedChart(itemValue)}
                style={styles.picker}
                dropdownIconColor={isInitialLoad ? "#cbd5e1" : "#64748b"}
                enabled={!isInitialLoad}
              >
                {data.charts && data.charts.length > 0 ? (
                  data.charts.map(c => (
                    <Picker.Item
                      key={c.val}
                      label={c.label}
                      value={c.val}
                      style={{ fontSize: 14 }}
                    />
                  ))
                ) : (
                  <Picker.Item label="Tidak ada grafik" value="" style={{ fontSize: 14 }} />
                )}
              </Picker>
            </View>

            <View style={[styles.pickerWrapper, isInitialLoad && styles.disabledPicker]}>
              <MaterialCommunityIcons
                name="calendar-range"
                size={16}
                color={isInitialLoad ? "#cbd5e1" : "#64748b"}
                style={styles.pickerIcon}
              />
              <Picker
                selectedValue={selectedPeriod}
                onValueChange={(itemValue) => setSelectedPeriod(itemValue)}
                style={styles.picker}
                dropdownIconColor={isInitialLoad ? "#cbd5e1" : "#64748b"}
                enabled={!isInitialLoad}
              >
                <Picker.Item
                  label="24 Jam"
                  value="hari"
                  style={{ fontSize: 14, color: isInitialLoad ? '#cbd5e1' : '#101011' }}
                />
                <Picker.Item
                  label="Minggu Ini"
                  value="minggu_ini"
                  style={{ fontSize: 14, color: isInitialLoad ? '#cbd5e1' : '#101011' }}
                />
              </Picker>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {isInitialLoad ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Memuat data grafik...</Text>
              </View>
            ) : loadingChart ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Memuat data...</Text>
              </View>
            ) : chartData ? (
              <LineChart
                data={chartData}
                width={SCREEN_WIDTH - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
              />
            ) : (
              <View style={styles.noDataContainer}>
                <MaterialCommunityIcons name="chart-ppf" size={40} color="#cbd5e1" />
                <Text style={styles.noDataText}>Tidak ada data grafik tersedia</Text>
              </View>
            )}
          </View>
          {isInitialLoad && (
            <View style={styles.skeletonOverlay}>
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative'
  },

  // Initial Loading Overlay
  initialLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  initialLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

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

  // Disabled States
  disabledCard: {
    opacity: 0.7,
  },
  disabledPicker: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b'
  },
  statusContainer: {
    alignItems: 'flex-end'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  syncText: {
    fontSize: 9,
    color: '#f59e0b'
  },

  // Scroll Content
  scrollContent: {
    padding: 15
  },

  // Grid & Cards
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  subLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4
  },
  valBig: {
    fontSize: 24,
    fontWeight: '900'
  },

  // Progress Bars
  progressBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3
  },

  // Sections
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginVertical: 15,
    marginLeft: 5
  },

  // Nutrient Grid
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  gridItem: {
    backgroundColor: '#fff',
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    position: 'relative',
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  listLabel: {
    fontSize: 12,
    color: '#030303',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  listVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b'
  },
  listUnit: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: 'normal'
  },

  // Chart Section
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    position: 'relative',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow wrapping on small screens
    gap: 10,
    marginBottom: 15
  },
  pickerWrapper: {
    flex: 1,
    minWidth: 140, // Ensure minimum width so text isn't cut off
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerIcon: {
    marginLeft: 10,
  },
  picker: {
    flex: 1,
    height: 45, // Slightly taller for better touch area
    color: '#0f172a',
  },
  chartContainer: {
    minHeight: 250,
    justifyContent: 'center',
  },
  chart: {
    marginVertical: 10,
    borderRadius: 16
  },

  // Loading & No Data States
  loaderContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});