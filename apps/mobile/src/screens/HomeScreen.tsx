import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LocationService } from '../services/LocationService';
import { useLocationStore } from '../store/useLocationStore';

export function HomeScreen() {
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<LocationService | null>(null);
  const { pendingCount, isTracking, setPendingCount, setTracking } = useLocationStore();

  useEffect(() => {
    serviceRef.current = new LocationService();
    const unsub = serviceRef.current.onPendingChange(setPendingCount);
    return () => {
      unsub();
      serviceRef.current?.stopTracking();
    };
  }, [setPendingCount]);

  async function toggleTracking() {
    if (isTracking) {
      serviceRef.current?.stopTracking();
      setTracking(false);
      return;
    }

    try {
      await serviceRef.current?.startTracking();
      setTracking(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar tracking');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>FleetPortal Conductor</Text>
      <Text style={styles.subtitle}>Telemetría GPS offline-first</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Estado</Text>
        <Text style={[styles.value, isTracking ? styles.active : styles.inactive]}>
          {isTracking ? 'Enviando ubicación' : 'Detenido'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Eventos pendientes de sync</Text>
        <Text style={styles.value}>{pendingCount}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={toggleTracking}>
        <Text style={styles.buttonText}>{isTracking ? 'Detener' : 'Iniciar tracking'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 32 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '600', color: '#f1f5f9' },
  active: { color: '#22c55e' },
  inactive: { color: '#94a3b8' },
  error: { color: '#f87171', marginBottom: 12 },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
