// Floating "glass" bottom tab bar. It sits absolutely positioned over the screens,
// so every scrollable screen adds useTabBarSpace() as bottom padding to scroll clear of it.
// Colours follow the personalised home palette (or the Westpac palette on the standard home).

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { PALETTES } from '../src/personalise/themes';
import { buildHome } from '../src/personalise/buildHome';
import { usePersonalisation } from '../src/personalise/store';

const BAR_HEIGHT = 64;
const SIDE_GAP = 12;

// Distance from the bottom of the screen to the bar's bottom edge.
const barOffset = (insets) => Math.max(insets.bottom, 12);

// Bottom padding a screen needs so its last content scrolls fully above the bar.
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + barOffset(insets) + 16;
}

function useTabBarTheme() {
  const personal = usePersonalisation();
  return useMemo(
    () => (personal ? buildHome(personal.answers).theme : PALETTES.westpac),
    [personal],
  );
}

export default function GlassTabBar({ tabs, activeTab, onSelect }) {
  const insets = useSafeAreaInsets();
  const theme = useTabBarTheme();

  return (
    <View
      style={[
        styles.wrap,
        { bottom: barOffset(insets), borderColor: theme.dark ? '#FFFFFF26' : '#FFFFFF99' },
      ]}
    >
      <BlurView
        intensity={40}
        tint={theme.dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {/* Palette tint over the blur; translucent so content shows through like glass */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.surface}B3` }]} />

      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.name;

          if (tab.center) {
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                onPress={() => onSelect(tab.name)}
                accessibilityLabel={tab.name}
              >
                <View style={[styles.centerButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name={tab.icon} size={24} color={theme.onAccent} />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={tab.name} style={styles.tab} onPress={() => onSelect(tab.name)}>
              <Ionicons name={tab.icon} size={22} color={active ? theme.link : theme.muted} />
              <Text
                style={[
                  styles.tabText,
                  { color: active ? theme.text : theme.muted },
                  active && styles.activeTabText,
                ]}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SIDE_GAP,
    right: SIDE_GAP,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabText: { fontSize: 11, fontWeight: '500' },
  activeTabText: { fontWeight: '700' },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
