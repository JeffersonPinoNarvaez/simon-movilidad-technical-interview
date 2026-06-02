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
import { sendTelemetry, type TelemetryPayload } from '../services/SyncService';
import { useLocationStore } from '../store/useLocationStore';

export function SyncScreen() {
  const { pendingCount, setPendingCount } = useLocationStore();
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

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
      setLastResult(`${synced} evento(s) sincronizado(s)`);
      await refreshPending();
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : 'Error de sincronización');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Estado de sincronización</Text>
        <Text style={styles.subtitle}>Cola offline-first · batch de 50 eventos</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Conexión</Text>
          <Text style={[styles.value, isOnline ? styles.online : styles.offline]}>
            {isOnline ? 'En línea' : 'Sin red'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Eventos pendientes</Text>
          <Text style={styles.value}>{pendingCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Última sincronización</Text>
          <Text style={styles.valueSmall}>{lastSyncAt ?? 'Aún no se ha sincronizado'}</Text>
        </View>

        {lastResult && <Text style={styles.result}>{lastResult}</Text>}

        <TouchableOpacity
          style={[styles.button, (!isOnline || syncing) && styles.buttonDisabled]}
          onPress={handleSyncNow}
          disabled={!isOnline || syncing || pendingCount === 0}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sincronizar ahora</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Cuando no hay red, los eventos GPS se guardan en SQLite local y se envían en lote al reconectar.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 20, marginTop: 4 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  value: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginTop: 4 },
  valueSmall: { fontSize: 16, color: '#f1f5f9', marginTop: 4 },
  online: { color: '#22c55e' },
  offline: { color: '#f87171' },
  result: { color: '#86efac', marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 16, lineHeight: 18 },
});
