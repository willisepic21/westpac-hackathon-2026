import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTabBarSpace } from '../components/GlassTabBar';
import ActionsScreen from '../src/actions/ActionsScreen';
import { useActions } from '../src/actions/store';
import { navigate, useRoute } from '../src/navigation';

const NAVY = '#1F1C4F';

// Sub-pages reachable from More. Add new sections here.
const PAGES = {
  Actions: ActionsScreen,
};

export default function MoreScreen() {
  const { screen } = useRoute();
  const Page = PAGES[screen];
  if (Page) return <Page onBack={() => navigate('More')} />;
  return <MoreMenu />;
}

function MoreMenu() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { actions } = useActions();

  const items = [
    {
      key: 'Actions',
      icon: 'flash',
      title: 'Actions',
      subtitle: actions.length
        ? `${actions.length} automation${actions.length === 1 ? '' : 's'} running`
        : 'Automate moving money between your accounts',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabBarSpace, paddingHorizontal: 16, gap: 12 }}
    >
      <Text style={styles.title}>More</Text>
      {items.map((item) => (
        <Pressable key={item.key} style={styles.row} onPress={() => navigate('More', item.key)} accessibilityRole="button">
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>
      ))}
      <Text style={styles.subtitle}>More sections are waiting for teammate mockups.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  title: { fontSize: 26, fontWeight: '800', color: NAVY },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D5002B', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  rowSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  subtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 8 },
});
