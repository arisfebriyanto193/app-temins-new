import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Switch, FlatList, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MqttMsg {
  topic: string;
  message: string;
  timestamp: string;
  direction: 'in' | 'out';
}

const PREDEFINED_BROKERS = [
  { name: 'karsacerdasinovatif', host: 'karsacerdasinovatif.web.id', port: '8081', protocol: 'wss' as const },
];

export default function MqttPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [host, setHost] = useState('karsacerdasinovatif.web.id');
  const [port, setPort] = useState('8081');
  const [clientId] = useState('admin_' + Math.random().toString(16).substring(2, 8));
  const [protocol, setProtocol] = useState<'ws' | 'wss'>('wss');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cleanSession, setCleanSession] = useState(true);
  const [publishTopic, setPublishTopic] = useState('temins_iot/');
  const [publishMsg, setPublishMsg] = useState('{"data": "Hello MQTT!"}');
  const [retain, setRetain] = useState(false);
  const [subscribeTopic, setSubscribeTopic] = useState('temins_iot/');
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [messages, setMessages] = useState<MqttMsg[]>([]);
  const [activeTab, setActiveTab] = useState<'config' | 'publish' | 'subscribe' | 'log'>('config');
  const clientRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (clientRef.current) clientRef.current.end(); };
  }, []);

  const addLog = (topic: string, message: string, direction: 'in' | 'out') => {
    setMessages(prev => [{
      topic, message, direction,
      timestamp: new Date().toLocaleTimeString('id-ID')
    }, ...prev].slice(0, 500));
  };

  const connect = async () => {
    if (isConnected || isConnecting) { disconnect(); return; }
    setIsConnecting(true); setConnError(null);
    addLog('System', `Connecting to ${protocol}://${host}:${port}...`, 'out');
    try {
      const mqtt = require('mqtt');
      const client = mqtt.connect(`${protocol}://${host}:${port}/mqtt`, {
        clientId, clean: cleanSession,
        username: username || undefined, password: password || undefined,
        reconnectPeriod: 0,
      });
      client.on('connect', () => { setIsConnected(true); setIsConnecting(false); addLog('System', `Connected to ${host}:${port}`, 'out'); });
      client.on('error', (err: any) => { setIsConnected(false); setIsConnecting(false); setConnError(err.message); addLog('System', `Error: ${err.message}`, 'out'); });
      client.on('close', () => { setIsConnected(false); setIsConnecting(false); setSubscribedTopics([]); addLog('System', 'Disconnected', 'out'); });
      client.on('message', (t: string, payload: any) => { addLog(t, payload.toString(), 'in'); });
      clientRef.current = client;
    } catch (e: any) {
      setIsConnecting(false); setConnError(e.message);
      addLog('System', `Failed: ${e.message}`, 'out');
    }
  };

  const disconnect = () => { if (clientRef.current) { clientRef.current.end(); clientRef.current = null; } };

  const subscribe = () => {
    if (!clientRef.current || !isConnected) { Alert.alert('Error', 'Belum terkoneksi'); return; }
    if (!subscribeTopic.trim()) { Alert.alert('Error', 'Topic kosong'); return; }
    clientRef.current.subscribe(subscribeTopic, { qos: 0 }, (err: any) => {
      if (err) addLog('System', `Subscribe failed: ${err.message}`, 'out');
      else { setSubscribedTopics(p => p.includes(subscribeTopic) ? p : [...p, subscribeTopic]); addLog('System', `Subscribed: ${subscribeTopic}`, 'out'); }
    });
  };

  const unsubscribe = (topic: string) => {
    if (!clientRef.current) return;
    clientRef.current.unsubscribe(topic, () => {
      setSubscribedTopics(p => p.filter(t => t !== topic));
      addLog('System', `Unsubscribed: ${topic}`, 'out');
    });
  };

  const publish = () => {
    if (!clientRef.current || !isConnected) { Alert.alert('Error', 'Belum terkoneksi'); return; }
    if (!publishTopic.trim() || !publishMsg.trim()) { Alert.alert('Error', 'Topic dan pesan tidak boleh kosong'); return; }
    clientRef.current.publish(publishTopic, publishMsg, { qos: 0, retain }, (err: any) => {
      if (err) addLog('System', `Publish failed: ${err.message}`, 'out');
      else addLog(publishTopic, publishMsg, 'out');
    });
  };

  const isValidJson = (s: string) => { try { JSON.parse(s); return true; } catch { return false; } };
  const statusColor = isConnected ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444';
  const statusText = isConnected ? 'CONNECTED' : isConnecting ? 'CONNECTING...' : 'DISCONNECTED';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MQTT Tester</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.connectBtn, { backgroundColor: isConnected ? '#ef4444' : '#6366f1' }]} onPress={connect}>
          <Ionicons name={isConnected ? 'close' : 'flash'} size={16} color="white" />
          <Text style={styles.connectBtnText}>{isConnected ? 'Putus' : 'Connect'}</Text>
        </TouchableOpacity>
      </View>

      {connError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{connError}</Text>
        </View>
      )}

      <View style={styles.tabBar}>
        {(['config', 'publish', 'subscribe', 'log'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'config' ? 'Config' : tab === 'publish' ? 'Kirim' : tab === 'subscribe' ? 'Sub' : `Log(${messages.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'config' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionLabel}>Broker Preset</Text>
          {PREDEFINED_BROKERS.map(b => (
            <TouchableOpacity key={b.name} style={styles.presetBtn} onPress={() => { setHost(b.host); setPort(b.port); setProtocol(b.protocol); }}>
              <Text style={styles.presetName}>{b.name}</Text>
              <Text style={styles.presetSub}>{b.host}:{b.port} ({b.protocol})</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Konfigurasi Broker</Text>
            {[['Host *', host, setHost, 'broker.hivemq.com'], ['Port *', port, setPort, '8884']].map(([label, value, setter, ph]) => (
              <View key={label as string}>
                <Text style={styles.fieldLabel}>{label as string}</Text>
                <TextInput style={styles.input} value={value as string} onChangeText={setter as any} placeholder={ph as string} placeholderTextColor="#94a3b8" />
              </View>
            ))}
            <Text style={styles.fieldLabel}>Protocol</Text>
            <View style={styles.segmentRow}>
              {(['ws', 'wss'] as const).map(p => (
                <TouchableOpacity key={p} style={[styles.segmentBtn, protocol === p && styles.segmentBtnActive]} onPress={() => setProtocol(p)}>
                  <Text style={[styles.segmentText, protocol === p && styles.segmentTextActive]}>{p}://</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Optional" placeholderTextColor="#94a3b8" autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Optional" placeholderTextColor="#94a3b8" secureTextEntry />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Clean Session</Text>
              <Switch value={cleanSession} onValueChange={setCleanSession} trackColor={{ true: '#6366f1' }} />
            </View>
          </View>
          <TouchableOpacity style={[styles.bigBtn, { backgroundColor: isConnected ? '#ef4444' : '#6366f1' }]} onPress={connect}>
            <Text style={styles.bigBtnText}>{isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect ke Broker'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeTab === 'publish' && (
        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Publish Pesan</Text>
            <Text style={styles.fieldLabel}>Topic *</Text>
            <TextInput style={styles.input} value={publishTopic} onChangeText={setPublishTopic} autoCapitalize="none" placeholderTextColor="#94a3b8" />
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Pesan *</Text>
              <Text style={[styles.jsonBadge, { backgroundColor: isValidJson(publishMsg) ? '#dcfce7' : '#fee2e2', color: isValidJson(publishMsg) ? '#16a34a' : '#dc2626' }]}>
                {isValidJson(publishMsg) ? 'Valid JSON' : 'Invalid JSON'}
              </Text>
            </View>
            <TextInput style={[styles.input, styles.textarea]} value={publishMsg} onChangeText={setPublishMsg} multiline numberOfLines={5} placeholderTextColor="#94a3b8" />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Retain</Text>
              <Switch value={retain} onValueChange={setRetain} trackColor={{ true: '#6366f1' }} />
            </View>
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: '#22c55e', opacity: isConnected ? 1 : 0.5 }]} onPress={publish} disabled={!isConnected}>
              <Text style={styles.bigBtnText}>Publish Pesan</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeTab === 'subscribe' && (
        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subscribe Topic</Text>
            <Text style={styles.fieldLabel}>Topic *</Text>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={subscribeTopic} onChangeText={setSubscribeTopic} autoCapitalize="none" placeholderTextColor="#94a3b8" />
              <TouchableOpacity style={[styles.subBtn, { opacity: isConnected ? 1 : 0.5 }]} onPress={subscribe} disabled={!isConnected}>
                <Text style={styles.subBtnText}>Subscribe</Text>
              </TouchableOpacity>
            </View>
          </View>
          {subscribedTopics.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Active Subscriptions</Text>
              {subscribedTopics.map(topic => (
                <View key={topic} style={styles.topicRow}>
                  <Ionicons name="notifications" size={16} color="#6366f1" />
                  <Text style={styles.topicText} numberOfLines={1}>{topic}</Text>
                  <TouchableOpacity onPress={() => unsubscribe(topic)}><Ionicons name="close" size={18} color="#ef4444" /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeTab === 'log' && (
        <View style={{ flex: 1 }}>
          <View style={styles.logToolbar}>
            <Text style={styles.logCount}>{messages.length} pesan</Text>
            <TouchableOpacity onPress={() => setMessages([])} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={[styles.logRow, { borderLeftColor: item.direction === 'in' ? '#22c55e' : '#6366f1' }]}>
                <View style={styles.logHeader}>
                  <Ionicons name={item.direction === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'} size={12} color={item.direction === 'in' ? '#22c55e' : '#6366f1'} />
                  <Text style={[styles.logTopic, { color: item.direction === 'in' ? '#22c55e' : '#6366f1' }]}>{item.topic}</Text>
                  <Text style={styles.logTime}>{item.timestamp}</Text>
                </View>
                <Text style={styles.logMsg}>{item.message}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.logEmpty}>
                <Ionicons name="terminal-outline" size={48} color="#cbd5e1" />
                <Text style={styles.logEmptyText}>Log kosong</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  connectBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fee2e2', paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#6366f1' },
  tabText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  tabTextActive: { color: '#6366f1', fontWeight: '700' },
  content: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  textarea: { height: 100, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jsonBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  segmentBtnActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  segmentText: { fontSize: 13, color: '#64748b' },
  segmentTextActive: { color: '#6366f1', fontWeight: '700' },
  presetBtn: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  presetName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  presetSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  bigBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 14, marginTop: 12 },
  bigBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  subBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  subBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  topicText: { flex: 1, fontSize: 13, color: '#334155' },
  logToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  logCount: { fontSize: 13, color: '#64748b' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  logRow: { marginHorizontal: 12, marginVertical: 3, backgroundColor: '#1e293b', borderRadius: 8, padding: 10, borderLeftWidth: 3 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  logTopic: { flex: 1, fontSize: 11, fontWeight: '600' },
  logTime: { fontSize: 10, color: '#64748b' },
  logMsg: { fontSize: 11, color: '#94a3b8' },
  logEmpty: { alignItems: 'center', paddingVertical: 80 },
  logEmptyText: { fontSize: 15, color: '#475569', marginTop: 12, fontWeight: '600' },
});
