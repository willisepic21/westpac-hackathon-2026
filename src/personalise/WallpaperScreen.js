// More > Wallpaper: pick a background for the Home screen (or none). Saved to customisation.wallpaper.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '../../components/GlassTabBar';
import { fill, findWallpaper } from './WallpaperBackground';
import { setWallpaper, useWallpaper } from './store';
import { WALLPAPERS } from './wallpapers';

const RED = '#D5002B';
const NAVY = '#1F1C4F';
const COLUMNS = 3;
const GAP = 10;
const PAD = 16;

export default function WallpaperScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const current = useWallpaper();
  const [warning, setWarning] = useState(null);

  // Square-ish tiles that fill the row (capped so it still looks right on tablets / web).
  const tile = Math.floor((Math.min(width, 600) - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const preview = findWallpaper(current);

  const choose = async (id) => {
    setWarning(null);
    const saved = await setWallpaper(id);
    if (saved === false) setWarning("Couldn't save to the database, so this will reset when you sign in again.");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F3F4F6' }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabBarSpace, paddingHorizontal: PAD, gap: 14 }}
    >
      <View style={styles.titleRow}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>Wallpaper</Text>
      </View>
      <Text style={styles.intro}>Choose a background for your Home screen.</Text>

      {/* Preview of the Home background, with a sample card on top */}
      <View style={[styles.preview, { height: tile * 1.4 }]}>
        {preview ? (
          <Image source={preview.full} style={fill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F5F5F7' }]} />
        )}
        <View style={styles.sampleCard}>
          <Text style={styles.sampleTitle}>Westpac Choice</Text>
          <Text style={styles.sampleValue}>$1,874.82</Text>
        </View>
      </View>

      {warning && <Text style={styles.warning}>{warning}</Text>}

      <View style={styles.grid}>
        <Pressable
          onPress={() => choose(0)}
          style={[styles.tile, { width: tile, height: tile }, styles.none, current === 0 && styles.selected]}
          accessibilityRole="button"
          accessibilityLabel="No wallpaper"
          accessibilityState={{ selected: current === 0 }}
        >
          <Ionicons name="ban-outline" size={26} color="#6B7280" />
          <Text style={styles.noneText}>None</Text>
        </Pressable>
        {WALLPAPERS.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => choose(w.id)}
            style={[styles.tile, { width: tile, height: tile }, current === w.id && styles.selected]}
            accessibilityRole="button"
            accessibilityLabel={`Wallpaper ${w.id}`}
            accessibilityState={{ selected: current === w.id }}
          >
            <Image source={w.thumb} style={fill} resizeMode="cover" />
            {current === w.id && (
              <View style={styles.tick}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: NAVY },
  intro: { fontSize: 14, color: '#4B5563' },
  preview: { borderRadius: 14, overflow: 'hidden', justifyContent: 'center', padding: 16 },
  sampleCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, opacity: 0.95 },
  sampleTitle: { fontSize: 14, color: '#4B5563' },
  sampleValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },
  warning: { color: '#B45309', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#E5E7EB', borderWidth: 3, borderColor: 'transparent' },
  none: { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#fff' },
  noneText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  selected: { borderColor: RED },
  tick: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
