// screens/AWLRDashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LineChart } from 'react-native-chart-kit';
import * as Network from 'expo-network';
import mqtt from 'mqtt';
import {
  Waves,
  Moon,
  Sun,
  ShieldCheck,
  Bolt,
  Activity,
  Satellite,
  AlertTriangle,
  Bell,
  Menu,
  Settings2,
  Wifi,
  WifiOff,
  Database,
  X,
  LogOut,
  BarChart3,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DeviceData {
  device: {
    id: string;
    data: string;
    statusData: string;
    max_height: string;
    owner: string;
    lokasi: string;
    jenis: string;
    grafik: string;
    zonawaktu: string;
  };
  mqtt: {
    topics: string[];
    topic_batt: string;
  };
  initial: {
    distance: number;
    battery: number;
  };
}

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function AWLRDashboard() {
  const navigation = useNavigation<NavigationProp>();

  // State Data
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [distance, setDistance] = useState(0);
  const [battery, setBattery] = useState(0);
  const [mqttStatus, setMqttStatus] = useState<string>('OFFLINE');
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [periode, setPeriode] = useState('hari');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [isDataReady, setIsDataReady] = useState(false);
  const [offlineDuration, setOfflineDuration] = useState('');
  const [unit, setUnit] = useState<'cm' | 'mm'>('cm');

  const mqttClient = useRef<mqtt.MqttClient | null>(null);
  const dataFetchInterval = useRef<NodeJS.Timeout | null>(null);
  const offlineTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTime = useRef(Date.now());
  const hasFetchedOffline = useRef(false);
  const initialFetchDone = useRef(false);
  const appState = useRef(AppState.currentState);

  // Cek koneksi internet
  const checkOnlineStatus = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const online = networkState.isConnected && networkState.isInternetReachable;
      setIsOnline(!!online);
      
      if (online) {
        console.log('✅ Device is online');
        hasFetchedOffline.current = false;
      } else {
        console.log('⚠️ Device is offline, using cached data');
        setMqttStatus('OFFLINE (No Internet)');
      }
    } catch (error) {
      console.error('Error checking network:', error);
      setIsOnline(false);
    }
  }, []);

  // Fungsi untuk mengambil data dari API
  const fetchDataFromAPI = useCallback(async () => {
    if (!deviceData?.device?.id) {
      console.log('⚠️ Device data not ready yet');
      return;
    }

    try {
      console.log('📡 Fetching data from API...');
      const apiUrl = process.env.EXPO_PUBLIC_API_DATA || 'https://your-api-url.com';
      const apiToken = process.env.EXPO_PUBLIC_API_TOKEN || 'your-token';
      
      const url = `${apiUrl}/api/get-data?device_id=${deviceData.device.id}&jenis=${deviceData.device.data}&periode=now`;
      console.log('API URL:', url);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      const json = await res.json();
      console.log('API Response:', json);

      if (json.status && json.data) {
        const sensorData = json.data.find(
          (item: any) => item.parameter_name === deviceData.device.data
        );
        const batteryData = json.data.find((item: any) => item.parameter_name === 'tsp');
        const waktu = sensorData?.recorded_at;

        if (sensorData) {
          const val = parseFloat(sensorData.value);
          let newDistance = val;

          if (deviceData.device.statusData === '1') {
            const maxHeight = parseFloat(deviceData.device.max_height);
            newDistance = maxHeight - val;
            console.log(`📐 API Data - Max Height: ${maxHeight}, Raw: ${val}, Calculated: ${newDistance}`);
          }

          setDistance(newDistance >= 0 ? newDistance : 0);
        }

        if (batteryData) {
          setBattery(parseFloat(batteryData.value));
        }

        if (waktu) {
          setLastUpdateTime(waktu);
        }

        console.log('✅ API data updated successfully');
        hasFetchedOffline.current = true;
        
        // Simpan ke cache
        await AsyncStorage.setItem('cachedData', JSON.stringify({
          distance: newDistance >= 0 ? newDistance : 0,
          battery: batteryData ? parseFloat(batteryData.value) : battery,
          lastUpdate: waktu,
        }));
      }
    } catch (err: any) {
      console.error('❌ Error fetching data from API:', err);
      
      // Coba ambil dari cache
      try {
        const cached = await AsyncStorage.getItem('cachedData');
        if (cached) {
          const { distance: cachedDistance, battery: cachedBattery } = JSON.parse(cached);
          setDistance(cachedDistance);
          setBattery(cachedBattery);
        }
      } catch (cacheError) {
        console.error('Error reading cache:', cacheError);
      }
    } finally {
      setIsDataReady(true);
    }
  }, [deviceData, battery]);

  // 1. Fetch Config & Initial Data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
           const token = await AsyncStorage.getItem('user_token');
        if (!token) {
          navigation.navigate('Login');
          return;
        }

        console.log('🔄 Fetching initial device config...');
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://your-api-url.com';
        
        const res = await fetch(`${apiUrl}/api-app/user/awlr/ds.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();

        if (json.status) {
          console.log('✅ Device config loaded:', json);
          setDeviceData(json);
          setDistance(json.initial.distance);
          setBattery(json.initial.battery);
          setIsInitialized(true);
          
          // Simpan ke cache
          await AsyncStorage.setItem('deviceConfig', JSON.stringify(json));
        }
      } catch (err) {
        console.error('❌ Initial Fetch Error:', err);
        
        // Coba ambil dari cache
        try {
          const cachedConfig = await AsyncStorage.getItem('deviceConfig');
          if (cachedConfig) {
            const config = JSON.parse(cachedConfig);
            setDeviceData(config);
            setDistance(config.initial.distance);
            setBattery(config.initial.battery);
            setIsInitialized(true);
          }
        } catch (cacheError) {
          console.error('Error reading cached config:', cacheError);
        }
      }
    };

    checkOnlineStatus();
    
    // Setup network listener
    const interval = setInterval(checkOnlineStatus, 10000); // Check every 10 seconds
    
    fetchInitialData();

    return () => {
      if (mqttClient.current) {
        mqttClient.current.end();
      }
      if (dataFetchInterval.current) {
        clearInterval(dataFetchInterval.current);
      }
      if (offlineTimerInterval.current) {
        clearInterval(offlineTimerInterval.current);
      }
      clearInterval(interval);
    };
  }, [checkOnlineStatus, navigation]);

  // 2. Fetch API pertama kali setelah deviceData ready
  useEffect(() => {
    if (deviceData && !initialFetchDone.current) {
      console.log('🚀 Performing initial API fetch...');
      fetchDataFromAPI();
      initialFetchDone.current = true;
    }
  }, [deviceData, fetchDataFromAPI]);

  // 3. Setup MQTT Connection dengan timeout detection
  useEffect(() => {
    if (!deviceData || !isOnline) {
      console.log('📴 Skipping MQTT setup (offline mode or no device data)');
      if (!isOnline) {
        setMqttStatus('OFFLINE (No Internet)');
      }
      return;
    }

    const setupMQTT = () => {
      try {
        const client = mqtt.connect('wss://karsacerdasinovatif.web.id:8081', {
          clientId: `react_native_awlr_${Math.random().toString(16).slice(2, 10)}`,
          reconnectPeriod: 5000,
          connectTimeout: 5000,
          keepalive: 30,
        });

        client.on('connect', () => {
          console.log('✅ MQTT Connected');
          setMqttStatus('ONLINE');
          deviceData.mqtt.topics.forEach((t: string) => client.subscribe(t));
          lastMessageTime.current = Date.now();
          hasFetchedOffline.current = false;

          if (dataFetchInterval.current) {
            clearInterval(dataFetchInterval.current);
          }

          dataFetchInterval.current = setInterval(() => {
            const now = Date.now();
            const timeSinceLastMessage = now - lastMessageTime.current;

            if (timeSinceLastMessage > 5000) {
              setMqttStatus('OFFLINE');

              const diff = Math.floor(timeSinceLastMessage / 1000);
              if (diff < 60) {
                setOfflineDuration(`${diff} detik`);
              } else if (diff < 3600) {
                setOfflineDuration(`${Math.floor(diff / 60)} menit`);
              } else {
                setOfflineDuration(`${Math.floor(diff / 3600)} jam`);
              }

              if (!hasFetchedOffline.current && isOnline) {
                console.log('🔄 Fetching API once after 5s MQTT timeout');
                fetchDataFromAPI();
                hasFetchedOffline.current = true;
              }
            } else {
              setOfflineDuration('');
              setMqttStatus('ONLINE');
            }
          }, 1000);

          client.publish(`temins_iot/${deviceData.device.id}/setting`, '4;1000');
        });

        client.on('message', (topic, payload) => {
          lastMessageTime.current = Date.now();
          hasFetchedOffline.current = false;
          setMqttStatus('ONLINE');
          setOfflineDuration('');

          const val = parseFloat(payload.toString());

          const dataTopicPattern = `temins_iot/${deviceData.device.id}/data/${deviceData.device.data}`;

          if (topic === dataTopicPattern) {
            let newDistance = val;

            if (deviceData.device.statusData === '1') {
              const maxHeight = parseFloat(deviceData.device.max_height);
              newDistance = maxHeight - val;
            }

            const finalDistance = newDistance >= 0 ? newDistance : 0;
            setDistance(finalDistance);
          }

          if (topic === deviceData.mqtt.topic_batt) {
            setBattery(val);
          }
        });

        client.on('error', (err) => {
          console.error('❌ MQTT Error:', err);
          setMqttStatus('ERROR');
        });

        client.on('offline', () => {
          console.log('🔴 MQTT Offline');
          setMqttStatus('OFFLINE');
        });

        client.on('reconnect', () => {
          console.log('🔄 MQTT Reconnecting');
          setMqttStatus('RECONNECTING');
        });

        mqttClient.current = client;
      } catch (error) {
        console.error('❌ MQTT Connection Error:', error);
        setMqttStatus('ERROR');
      }
    };

    setupMQTT();

    return () => {
      if (mqttClient.current) {
        mqttClient.current.end();
      }
    };
  }, [deviceData, isOnline, fetchDataFromAPI]);

  // 4. Fetch jika offline
  useEffect(() => {
    if (!isOnline && deviceData && !hasFetchedOffline.current) {
      console.log('📡 Device offline, fetching from API...');
      fetchDataFromAPI();
    }
  }, [isOnline, deviceData, fetchDataFromAPI]);

  // 5. Fetch Chart History
  useEffect(() => {
    if (!deviceData) return;

    const fetchHistory = async () => {
      const dataGrafik = deviceData.device.grafik;
      let timezone = deviceData.device.zonawaktu;
      console.log('🚀 Zona Waktu:', timezone);
      
      const apiUrl = process.env.EXPO_PUBLIC_API_DATA || 'https://your-api-url.com';
      const apiToken = process.env.EXPO_PUBLIC_API_TOKEN || 'your-token';
      
      const url = `${apiUrl}/api/get-data?device_id=${deviceData.device.id}&jenis=${dataGrafik}&periode=${periode}&mode=ringkas&zonawaktu=${timezone}&limit=10`;

      console.log('📈 Fetching chart history:', url);

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });

        const json = await res.json();

        if (json.status && json.data) {
          console.log('📊 Chart data received:', json.data.length, 'records');

          const formatted = json.data.map((d: any) => {
            let tinggiAir;
            const nilaiData = parseFloat(d.value);

            if (deviceData.device.statusData === '1') {
              const maxHeight = parseFloat(deviceData.device.max_height);
              tinggiAir = Math.max(0, maxHeight - nilaiData);
            } else {
              tinggiAir = Math.max(0, nilaiData);
            }

            // Parse waktu dari API dan konversi ke timestamp
            const dateTime = new Date(d.recorded_at.replace(' ', 'T'));

            return {
              x: dateTime.getTime(), // Timestamp dalam milliseconds
              y: tinggiAir,
            };
          });

          setChartData(formatted);
        }
      } catch (err) {
        console.error('❌ History fetch error:', err);
      }
    };

    fetchHistory();
  }, [deviceData, periode]);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'username']);
    navigation.navigate('Login');
  };

  // Helper Konversi
  const convertVal = (valInCm: number) => {
    return unit === 'mm' ? valInCm * 10 : valInCm;
  };

  // Logic Perhitungan TMA
  const tmaCm = distance;
  const maxHeight = deviceData ? parseFloat(deviceData.device.max_height) : 0;

  let percentage = 0;
  const jenis = deviceData?.device?.jenis?.toLowerCase() || 'sungai';

  if (maxHeight > 0) {
    if (jenis === 'sumur') {
      percentage = Math.min(100, ((maxHeight - tmaCm) / maxHeight) * 100);
    } else {
      percentage = Math.min(100, (tmaCm / maxHeight) * 100);
    }
  }

  const tmaDisplay = convertVal(tmaCm);
  const distanceDisplay = convertVal(tmaCm);
  const maxHeightDisplay = deviceData ? convertVal(maxHeight) : 0;

  const getStatus = () => {
    if (percentage >= 80)
      return {
        label: 'BAHAYA',
        color: '#ef4444',
        border: '#ef4444',
        bg: '#fee2e2',
        icon: <AlertTriangle size={24} color="#ef4444" />,
      };
    if (percentage >= 50)
      return {
        label: 'SIAGA',
        color: '#f59e0b',
        border: '#3b82f6',
        bg: '#fef3c7',
        icon: <Bolt size={24} color="#f59e0b" />,
      };
    return {
      label: 'AMAN',
      color: '#3b82f6',
      border: '#3b82f6',
      bg: '#dbeafe',
      icon: <ShieldCheck size={24} color="#3b82f6" />,
    };
  };

  const status = getStatus();
  const waterLabel = jenis === 'sumur' ? 'Kedalaman Air' : 'Tinggi Air';

  // Format data untuk chart
  const chartLabels = chartData.map((item) => {
    const date = new Date(item.x);
    return date.getHours() + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
  });

  const chartValues = chartData.map((item) =>
    unit === 'mm' ? item.y * 10 : item.y
  );

  if (!deviceData || !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loader} />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#f8fafc" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>


        <View style={styles.headerInfo}>
          <View style={styles.headerIcon}>
            <Waves size={24} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>
            {deviceData?.device.owner} - {deviceData?.device.lokasi}
            </Text>
            {mqttStatus.includes('ONLINE') && isOnline ? (
              <Text style={styles.onlineStatus}>● Live</Text>
            ) : (
              lastUpdateTime && (
                <Text style={styles.lastUpdate}>
                  Last updated: {lastUpdateTime}
                </Text>
              )
            )}
          </View>
        </View>

        <View style={styles.headerControls}>
         

          <View
            style={[
              styles.statusBadge,
              mqttStatus.includes('ONLINE') && isOnline
                ? styles.statusOnline
                : mqttStatus === 'RECONNECTING'
                ? styles.statusReconnecting
                : mqttStatus.includes('OFFLINE')
                ? styles.statusOffline
                : styles.statusError,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                mqttStatus.includes('ONLINE') && isOnline
                  ? styles.dotOnline
                  : mqttStatus === 'RECONNECTING'
                  ? styles.dotReconnecting
                  : mqttStatus.includes('OFFLINE')
                  ? styles.dotOffline
                  : styles.dotError,
              ]}
            />
            <Text style={styles.statusText}>{mqttStatus}</Text>
            {offlineDuration && mqttStatus === 'OFFLINE' && (
              <Text style={styles.offlineDuration}>({offlineDuration})</Text>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {!isOnline && (
          <View style={styles.offlineWarning}>
            <AlertTriangle size={16} color="#f97316" />
            <Text style={styles.offlineWarningText}>
              Anda sedang dalam mode offline. Data yang ditampilkan adalah data
              terakhir yang tersimpan dalam cache.
            </Text>
          </View>
        )}

        <View style={styles.mainContent}>
          {/* Visualizer Kolom Kiri */}
          <View style={styles.visualizerContainer}>
            <View style={styles.visualizer}>
              {/* Header Visualizer */}
              <View style={styles.visualizerHeader}>
                <View>
                  <Text style={styles.visualizerLabel}>Tinggi Sensor</Text>
                  <Text style={styles.visualizerValue}>
                    {maxHeightDisplay.toFixed(1)} {unit}
                  </Text>
                </View>
                <Satellite size={24} color="rgba(255,255,255,0.4)" />
              </View>

              {/* Water Level Indicator */}
              <View style={styles.waterContainer}>
                {/* Water Fill */}
                <View
                  style={[
                    styles.waterFill,
                    { height: `${percentage}%` },
                  ]}
                />

                {/* Water Level Scale */}
                <View style={styles.waterScale}>
                  {[1, 0.75, 0.5, 0.25, 0].map((v, i) => (
                    <View key={i} style={styles.scaleLine}>
                      <Text style={styles.scaleText}>
                        {(maxHeightDisplay * v).toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Water Level Value */}
                <View style={styles.waterLevelCenter}>
                  <Text style={styles.waterLevelLabel}>{waterLabel}</Text>
                  <View style={styles.waterLevelValueContainer}>
                    <Text style={styles.waterLevelValue}>
                      {tmaDisplay.toFixed(unit === 'mm' ? 0 : 1)}
                    </Text>
                    <Text style={styles.waterLevelUnit}>{unit}</Text>
                  </View>
                </View>
              </View>

              {/* River Bottom */}
              <View style={styles.riverBottom}>
                
              </View>
            </View>
          </View>

          {/* Stats & Chart Kolom Kanan */}
          <View style={styles.statsContainer}>
            {/* Battery Card */}
            <View style={styles.batteryCard}>
              
              <View>
                <Text style={styles.cardLabel}>Tegangan Baterai</Text>
                <View style={styles.valueContainer}>
                  <Text style={styles.valueText}>{battery.toFixed(1)}</Text>
                  <Text style={styles.unitText}>Volt</Text>
                </View>
              </View>
              <View style={styles.batteryIcon}>
                <Bolt size={24} color="#10b981" />
              </View>
            </View>

            {/* Status Card */}
            <View style={styles.unitSelectorContainer}>
            <Settings2 size={14} color="#64748b" style={styles.unitIcon} />
            <TouchableOpacity
              style={styles.unitSelector}
              onPress={() => setUnit(unit === 'cm' ? 'mm' : 'cm')}
            >
              <Text style={styles.unitText}>Satuan: {unit.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

            {/* Chart Area */}
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <View style={styles.chartTitleContainer}>
                  <Activity size={18} color="#3b82f6" />
                  <Text style={styles.chartTitle}>
                  {waterLabel}
                  </Text>
                  {!isOnline && (
                    <View style={styles.cachedBadge}>
                      <Text style={styles.cachedText}>Cached Data</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.periodSelector}
                  onPress={() => {
                    setPeriode(periode === 'hari' ? 'minggu_ini' : 'hari');
                  }}
                  disabled={!isOnline}
                >
                  <Text style={styles.periodText}>
                    {periode === 'hari' ? '24 Jam Terakhir' : '7 Hari Terakhir'}
                  </Text>
                </TouchableOpacity>
              </View>

              {chartValues.length > 0 && (
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [
                      {
                        data: chartValues,
                        color: () => '#3b82f6',
                        strokeWidth: 3,
                      },
                    ],
                  }}
                  width={SCREEN_WIDTH - 48}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: unit === 'mm' ? 0 : 1,
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#3b82f6',
                    },
                    propsForBackgroundLines: {
                      stroke: '#e2e8f0',
                      strokeWidth: 1,
                    },
                  }}
                  bezier
                  style={styles.chart}
                  formatYLabel={(value) => {
                    const num = parseFloat(value);
                    return num.toFixed(unit === 'mm' ? 0 : 1);
                  }}
                />
              )}
            </View>
          </View>
          
        </View>
      </ScrollView>

      {/* Sidebar */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sidebarOpen}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setSidebarOpen(false)}>
                <X size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarContent}>
              <TouchableOpacity style={styles.sidebarItem}>
                <Database size={20} color="#64748b" />
                <Text style={styles.sidebarItemText}>Data Historis</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem}>
                <BarChart3 size={20} color="#64748b" />
                <Text style={styles.sidebarItemText}>Laporan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidebarItem}>
                <Settings2 size={20} color="#64748b" />
                <Text style={styles.sidebarItemText}>Pengaturan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sidebarItem, styles.logoutButton]}
                onPress={() => {
                  setSidebarOpen(false);
                  setShowLogoutModal(true);
                }}
              >
                <LogOut size={20} color="#ef4444" />
                <Text style={[styles.sidebarItemText, styles.logoutText]}>
                  Keluar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <AlertTriangle size={28} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Konfirmasi Keluar</Text>
            <Text style={styles.modalMessage}>
              Apakah Anda yakin ingin keluar?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmButtonText}>Ya, Keluar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loader: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderTopColor: 'transparent',
    animationKeyframes: {
      '0%': { transform: [{ rotate: '0deg' }] },
      '100%': { transform: [{ rotate: '360deg' }] },
    },
    animationDuration: '1s',
    animationIterationCount: 'infinite',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  headerIcon: {
    padding: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  onlineStatus: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  lastUpdate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  unitIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  unitSelector: {
    paddingLeft: 32,
    paddingRight: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
  },
  unitText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  statusReconnecting: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  statusOffline: {
    backgroundColor: '#ffedd5',
    borderColor: '#f97316',
  },
  statusError: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotReconnecting: {
    backgroundColor: '#f59e0b',
  },
  dotOffline: {
    backgroundColor: '#f97316',
  },
  dotError: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  offlineDuration: {
    fontSize: 10,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffedd5',
    borderColor: '#fdba74',
    borderWidth: 1,
    margin: 16,
    borderRadius: 8,
  },
  offlineWarningText: {
    fontSize: 12,
    color: '#9a3412',
    marginLeft: 8,
    flex: 1,
  },
  mainContent: {
    padding: 16,
  },
  visualizerContainer: {
    marginBottom: 20,
  },
  visualizer: {
    height: SCREEN_HEIGHT * 0.6,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  visualizerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  visualizerLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
  },
  visualizerValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  waterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3b82f6',
  },
  waterScale: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  scaleLine: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  scaleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  waterLevelCenter: {
    alignItems: 'center',
  },
  waterLevelLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  waterLevelValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  waterLevelValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  waterLevelUnit: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  riverBottom: {
    height: 48,
    backgroundColor: '#2d2424',
    borderTopWidth: 4,
    borderTopColor: '#1a1414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riverBottomText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  statsContainer: {
    gap: 16,
  },
  batteryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderLeftWidth: 8,
    borderLeftColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  valueText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  chartContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  cachedBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cachedText: {
    fontSize: 10,
    color: '#9a3412',
  },
  periodSelector: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  chart: {
    borderRadius: 16,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#ffffff',
    height: '100%',
    marginLeft: 'auto',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sidebarContent: {
    padding: 20,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sidebarItemText: {
    fontSize: 16,
    color: '#1e293b',
  },
  logoutButton: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
});