import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTabBarSpace } from '../components/GlassTabBar';

export default function AccountsScreen() {
  const tabBarSpace = useTabBarSpace();
  return (
    <View style={[styles.container, { paddingBottom: tabBarSpace }]}>
      <Text style={styles.title}>Accounts Screen</Text>
      <Text style={styles.subtitle}>Ready for teammate mockup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6 },
});
