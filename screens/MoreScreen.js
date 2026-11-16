import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>More Screen</Text>
      <Text style={styles.subtitle}>Ready for teammate mockup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6 },
});
