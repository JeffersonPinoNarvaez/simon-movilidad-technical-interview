import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { getPendingCount, flushPendingEvents } from '../services/StorageService';
import { API_URL, sendTelemetry, type TelemetryPayload } from '../services/SyncService';
import { useLocationStore } from '../store/useLocationStore';

export function SyncScreen() {
  const { pendingCount, setPendingCount } = useLocationStore();
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, [setPendingCount]);

  useEffect(() => {
    void refreshPending();
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => unsub();
  }, [refreshPending]);

  async function handleSyncNow() {
    setSyncing(true);
    setLastResult(null);
    try {
      const synced = await flushPendingEvents(async (payload) => {
        return sendTelemetry(payload as TelemetryPayload);
      });
      setLastSyncAt(new Date().toLocaleString('es-CO'));
      setLastResult({ text: `${synced} evento(s) sincronizado(s)`, ok: true });
      await refreshPending();
    } catch (err) {
      setLastResult({
        text: err instanceof Error ? err.message : 'Error de sincronización',
        ok: false,
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Offline-first</Text>
        <Text style={styles.title}>Sincronización</Text>
        <Text style={styles.subtitle}>Cola local SQLite · lotes de 50 eventos</Text>
        <Text style={styles.apiHint}>API: {API_URL}</Text>

        <View style={styles.grid}>
          <View style={[styles.card, isOnline ? styles.cardOnline : styles.cardOffline]}>
            <Text style={styles.cardIcon}>{isOnline ? '●' : '○'}</Text>
            <Text style={styles.label}>Conexión</Text>
            <Text style={[styles.value, isOnline ? styles.online : styles.offline]}>
              {isOnline ? 'En línea' : 'Sin red'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>⏳</Text>
            <Text style={styles.label}>Pendientes</Text>
            <Text style={styles.value}>{pendingCount}</Text>
          </View>
        </View>

        <View style={styles.cardWide}>
          <Text style={styles.label}>Última sincronización</Text>
          <Text style={styles.valueSmall}>{lastSyncAt ?? 'Aún no se ha sincronizado'}</Text>
        </View>

        {lastResult && (
          <View style={[styles.resultBanner, lastResult.ok ? styles.resultOk : styles.resultErr]}>
            <Text style={styles.resultText}>{lastResult.text}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, (!isOnline || syncing || pendingCount === 0) && styles.buttonDisabled]}
          onPress={handleSyncNow}
          disabled={!isOnline || syncing || pendingCount === 0}
          activeOpacity={0.85}
        >
          {syncing ? (
            <View style={styles.syncingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Sincronizando…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>↻  Sincronizar ahora</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Sin red, los eventos GPS se guardan localmente y se envían en lote al reconectar.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#34d399',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 8, marginTop: 6 },
  apiHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 20,
    fontFamily: 'Menlo',
  },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardOnline: { borderColor: 'rgba(52, 211, 153, 0.25)' },
  cardOffline: { borderColor: 'rgba(248, 113, 113, 0.25)' },
  cardWide: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardIcon: { fontSize: 18, marginBottom: 8 },
  label: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginTop: 6 },
  valueSmall: { fontSize: 15, color: '#cbd5e1', marginTop: 6 },
  online: { color: '#34d399' },
  offline: { color: '#f87171' },
  resultBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  resultOk: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  resultErr: {
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  resultText: { color: '#e2e8f0', textAlign: 'center', fontSize: 14 },
  button: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  syncingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: '#475569', fontSize: 13, marginTop: 20, lineHeight: 20, textAlign: 'center' },
});
