// The user's chosen wallpaper (More > Wallpaper), filling its parent behind the content.
// A wash of the theme's background colour on top keeps titles and text readable over busy photos.
// Renders nothing when no wallpaper is set. Put it first inside a View with flex: 1.

import { Image, StyleSheet, View } from 'react-native';

import { useWallpaper } from './store';
import { WALLPAPERS } from './wallpapers';

export const findWallpaper = (id) => WALLPAPERS.find((w) => w.id === id);

// absoluteFill alone isn't enough for bundled images: on web, <Image> gives a require()d image its pixel size
// (e.g. 1080x1440) as width / height, which stretched the page past the phone's width. Size it explicitly.
export const fill = [StyleSheet.absoluteFill, { width: '100%', height: '100%' }];

export default function WallpaperBackground({ wash = '#FFFFFF', washOpacity = 0.15 }) {
  const wallpaper = findWallpaper(useWallpaper());
  if (!wallpaper) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <Image source={wallpaper.full} style={fill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wash, opacity: washOpacity }]} />
    </View>
  );
}

/** `#RRGGBB` + alpha -> rgba(), for see-through panels. */
export function withAlpha(hex, alpha) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Style for a frosted panel that keeps content readable over the wallpaper (theme background, mostly opaque).
 * Returns null when there is no wallpaper, so it can be spread into styles unconditionally.
 */
export function useWallpaperPanel(bg) {
  return useHasWallpaper()
    ? { backgroundColor: withAlpha(bg, 0.88), borderRadius: 18, marginHorizontal: 8, marginVertical: 5, overflow: 'hidden' }
    : null;
}

/** True when a wallpaper is set, so screens can make their own background transparent. */
export const useHasWallpaper = () => Boolean(findWallpaper(useWallpaper()));
