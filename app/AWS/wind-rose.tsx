import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Svg, { G, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ---- Types ----
interface WindDataPoint {
  dir: number;
  spd: number;
  ch?: number;
}

// ---- Constants ----
const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const SPEED_BINS = [
  { max: 2,        color: '#0ea5e9', label: '0–2 m/s' },
  { max: 5,        color: '#22c55e', label: '2–5 m/s' },
  { max: 10,       color: '#f59e0b', label: '5–10 m/s' },
  { max: Infinity, color: '#ef4444', label: '>10 m/s' },
];
const COMPASS_LABELS = [
  { label: 'N', index: 0 }, { label: 'NE', index: 2 }, { label: 'E', index: 4 },
  { label: 'SE', index: 6 }, { label: 'S', index: 8 }, { label: 'SW', index: 10 },
  { label: 'W', index: 12 }, { label: 'NW', index: 14 },
];

function calcWindRose(data: WindDataPoint[]): number[][] {
  const bins = Array.from({ length: 16 }, () => Array(SPEED_BINS.length).fill(0));
  data.forEach(({ dir, spd }) => {
    const segment = Math.round(dir / 22.5) % 16;
    const speedBin = SPEED_BINS.findIndex(b => spd < b.max);
    if (segment >= 0 && segment < 16 && speedBin >= 0) bins[segment][speedBin]++;
  });
  return bins;
}

// ---- Wind Rose SVG (light theme) ----
function WindRoseSvg({ bins }: { bins: number[][] }) {
  const SIZE = 280;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R = SIZE / 2 - 36;
  const totals = bins.map(b => b.reduce((a, v) => a + v, 0));
  const maxTotal = Math.max(...totals, 1);
  const paths: { d: string; color: string }[] = [];

  bins.forEach((segBins, i) => {
    const angle = (i * 22.5 - 90) * (Math.PI / 180);
    const nextAngle = ((i + 1) * 22.5 - 90) * (Math.PI / 180);
    let cumRadius = 0;
    segBins.forEach((count, bi) => {
      if (count === 0) return;
      const r0 = (cumRadius / maxTotal) * R;
      cumRadius += count;
      const r1 = (cumRadius / maxTotal) * R;
      const x0s = cx + Math.cos(angle) * r0, y0s = cy + Math.sin(angle) * r0;
      const x1s = cx + Math.cos(angle) * r1, y1s = cy + Math.sin(angle) * r1;
      const x1e = cx + Math.cos(nextAngle) * r1, y1e = cy + Math.sin(nextAngle) * r1;
      const x0e = cx + Math.cos(nextAngle) * r0, y0e = cy + Math.sin(nextAngle) * r0;
      const d = [`M ${x0s} ${y0s}`, `L ${x1s} ${y1s}`, `A ${r1} ${r1} 0 0 1 ${x1e} ${y1e}`,
        `L ${x0e} ${y0e}`, r0 > 0 ? `A ${r0} ${r0} 0 0 0 ${x0s} ${y0s}` : '', 'Z'].join(' ');
      paths.push({ d, color: SPEED_BINS[bi].color });
    });
  });

  return (
    <Svg width={SIZE} height={SIZE}>
      {/* Ring guides — light */}
      {[0.25, 0.5, 0.75, 1].map((f, idx) => (
        <Circle key={idx} cx={cx} cy={cy} r={R * f} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" fill="none" />
      ))}
      {/* Radial lines */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5 - 90) * (Math.PI / 180);
        return <Line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <G>{paths.map((p, idx) => <Path key={idx} d={p.d} fill={p.color + 'dd'} stroke={p.color} strokeWidth={0.5} />)}</G>
      <Circle cx={cx} cy={cy} r={4} fill="#0ea5e9" />
      {COMPASS_LABELS.map(({ label, index }) => {
        const a = (index * 22.5 - 90) * (Math.PI / 180);
        return (
          <SvgText key={label} x={cx + Math.cos(a) * (R + 20)} y={cy + Math.sin(a) * (R + 20)}
            fill={label === 'N' ? '#0ea5e9' : '#64748b'}
            fontSize={label === 'N' ? 13 : 11}
            fontWeight={label === 'N' ? 'bold' : 'normal'}
            textAnchor="middle" alignmentBaseline="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ---- Main Screen ----
export default function WindRoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [period, setPeriod] = useState<'hari' | 'minggu_ini' | 'bulan'>('hari');
  const [filterRain, setFilterRain] = useState(false);
  const [rawWindData, setRawWindData] = useState<WindDataPoint[]>([]);
  const [windData, setWindData] = useState<WindDataPoint[]>([]);
  const [bins, setBins] = useState<number[][]>(Array.from({ length: 16 }, () => Array(4).fill(0)));
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ avg: 0, max: 0, dominant: 'N', calms: 0 });

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const apiData = process.env.EXPO_PUBLIC_API_DATA;
  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN;

  useEffect(() => {
    const load = async () => {
      const token = await AsyncStorage.getItem('user_token');
      if (!token) { router.replace('../'); return; }
      try {
        const res = await fetch(`${apiUrl}/api-app/user/aws/history.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.status) { setDeviceId(json.device_id); setDeviceName(json.device_name); }
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const fetchWind = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` };
    const base = `${apiData}/api/get-data?device_id=${deviceId}&mode=raw&periode=${period}`;
    try {
      const [dirJ, spdJ, chJ] = await Promise.all([
        fetch(`${base}&jenis=aa`, { headers }).then(r => r.json()),
        fetch(`${base}&jenis=ka`, { headers }).then(r => r.json()),
        fetch(`${base}&jenis=ch`, { headers }).then(r => r.json()),
      ]);
      const dirData: Record<string, number> = {};
      const spdData: Record<string, number> = {};
      const chData: Record<string, number> = {};
      if (dirJ.status && dirJ.data) dirJ.data.forEach((d: any) => { dirData[d.recorded_at] = parseFloat(d.value); });
      if (spdJ.status && spdJ.data) spdJ.data.forEach((d: any) => { spdData[d.recorded_at] = parseFloat(d.value); });
      if (chJ.status && chJ.data) chJ.data.forEach((d: any) => { chData[d.recorded_at] = parseFloat(d.value); });
      const points: WindDataPoint[] = Object.keys(dirData)
        .filter(t => spdData[t] !== undefined)
        .map(t => ({ dir: dirData[t], spd: spdData[t], ch: chData[t] || 0 }))
        .filter(p => !isNaN(p.dir) && !isNaN(p.spd));
      setRawWindData(points);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [deviceId, period, apiData, apiToken]);

  useEffect(() => { fetchWind(); }, [fetchWind]);

  useEffect(() => {
    const filtered = filterRain ? rawWindData.filter(p => (p.ch ?? 0) === 0) : rawWindData;
    setWindData(filtered);
    setBins(calcWindRose(filtered));
    if (filtered.length > 0) {
      const speeds = filtered.map(p => p.spd);
      const avg = speeds.reduce((a, v) => a + v, 0) / speeds.length;
      const max = Math.max(...speeds);
      const calms = speeds.filter(s => s < 0.5).length;
      const dirCount = new Array(16).fill(0);
      filtered.forEach(p => { dirCount[Math.round(p.dir / 22.5) % 16]++; });
      const domIdx = dirCount.indexOf(Math.max(...dirCount));
      setStats({ avg: parseFloat(avg.toFixed(1)), max: parseFloat(max.toFixed(1)), dominant: DIRECTIONS[domIdx], calms });
    } else { setStats({ avg: 0, max: 0, dominant: 'N', calms: 0 }); }
  }, [rawWindData, filterRain]);

  const periodLabels: Record<string, string> = { hari: '24 Jam', minggu_ini: '7 Hari', bulan: 'Bulan Ini' };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="analytics" size={18} color="#0ea5e9" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Wind Rose</Text>
          <Text style={styles.headerSubtitle}>{deviceName || 'Memuat...'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        style={styles.scroll}>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {(['hari', 'minggu_ini', 'bulan'] as const).map(p => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{periodLabels[p]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter Rain */}
        <View style={styles.filterRow}>
          <View>
            <Text style={styles.filterLabel}>Filter data angin</Text>
            <Text style={styles.filterDesc}>Filter noise data angin saat hujan</Text>
          </View>
          <Switch value={filterRain} onValueChange={setFilterRain}
            trackColor={{ false: '#e2e8f0', true: '#0ea5e9' }} thumbColor="#ffffff" />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Rata-rata', value: `${stats.avg} m/s`, icon: 'speedometer-outline', color: '#0ea5e9' },
            { label: 'Maksimum',  value: `${stats.max} m/s`, icon: 'arrow-up-outline',    color: '#f59e0b' },
            { label: 'Dominan',  value: stats.dominant,      icon: 'compass-outline',      color: '#22c55e' },
            { label: 'Tenang',   value: `${stats.calms}`,    icon: 'pause-circle-outline', color: '#94a3b8' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={20} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          {loading ? (
            <View style={styles.centeredWrap}>
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text style={styles.loadingText}>Memuat data angin...</Text>
            </View>
          ) : windData.length === 0 ? (
            <View style={styles.centeredWrap}>
              <Ionicons name="analytics-outline" size={56} color="#e2e8f0" />
              <Text style={styles.emptyText}>Tidak ada data angin</Text>
            </View>
          ) : (
            <View style={styles.roseWrap}>
              <WindRoseSvg bins={bins} />
              <Text style={styles.dataPointLabel}>{windData.length} titik data</Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>LEGENDA KECEPATAN</Text>
          <View style={styles.legendGrid}>
            {SPEED_BINS.map(b => (
              <View key={b.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                <Text style={styles.legendLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerIconWrap: {
    backgroundColor: '#e0f2fe', borderRadius: 8, padding: 7,
    borderWidth: 1, borderColor: '#bae6fd',
  },
  headerTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: '#94a3b8', fontSize: 11 },
  scrollContent: { padding: 16, gap: 12 },

  // Period
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', elevation: 1,
  },
  periodBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  periodBtnText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },

  // Filter
  filterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 16, paddingVertical: 12, elevation: 1,
  },
  filterLabel: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  filterDesc: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0', padding: 14, alignItems: 'flex-start',
    gap: 4, elevation: 1,
  },
  statValue: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chart
  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 20, alignItems: 'center', minHeight: 320, justifyContent: 'center', elevation: 1,
  },
  centeredWrap: { alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  roseWrap: { alignItems: 'center', gap: 8 },
  dataPointLabel: { color: '#94a3b8', fontSize: 11 },

  // Legend
  legendCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 16, elevation: 1,
  },
  legendTitle: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: '40%' },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendLabel: { color: '#475569', fontSize: 13 },
});
