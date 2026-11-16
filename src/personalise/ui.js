// Shared building blocks for the personalised home widgets.
// Everything reads colours (theme) and spacing (d) from HomeStyleContext,
// so a widget looks right in any template / palette / density.

import React, { createContext, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const HomeStyleContext = createContext(null);
export const HomeStyleProvider = HomeStyleContext.Provider;
export const useHomeStyle = () => useContext(HomeStyleContext);

export const formatMoney = (n, { cents = true, sign = false } = {}) => {
  const abs = Math.abs(n).toLocaleString('en-AU', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const prefix = n < 0 ? '−' : sign ? '+' : '';
  return `${prefix}$${abs}`;
};

/**
 * Themed text.
 *   v:  'hero' (big number) | 'big' | 'title' | 'h' (section heading) | 'body' | 'small'
 *   on: 'bg' | 'hero' | 'accent'  — what it sits on, picks the right text colour
 */
export function T({ v = 'body', on = 'bg', muted, bold, color, style, children, ...rest }) {
  const { theme, d } = useHomeStyle();
  const size = { hero: d.hero, big: Math.round(d.hero * 0.72), title: d.title, h: 16, body: d.body, small: d.small }[v];
  const base = on === 'hero' ? theme.heroText : on === 'accent' ? theme.onAccent : theme.text;
  return (
    <Text
      style={[
        {
          fontSize: size,
          color: color ?? (muted && on === 'bg' ? theme.muted : base),
          opacity: muted && on !== 'bg' ? 0.78 : 1,
          fontWeight: bold || v === 'hero' || v === 'big' || v === 'title' || v === 'h' ? '700' : '400',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// Section = heading row (title + optional action link) + content.
// `bleed` lets carousels run to the screen edge.
export function Section({ title, action, onAction, bleed, children }) {
  const { theme, d } = useHomeStyle();
  return (
    <View style={{ marginTop: d.section }}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: d.pad,
            marginBottom: d.gap,
          }}
        >
          <T v="h">{title}</T>
          {action ? (
            <TouchableOpacity onPress={onAction} hitSlop={8}>
              <Text style={{ color: theme.link, fontSize: d.small, fontWeight: '600' }}>{action}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <View style={bleed ? null : { paddingHorizontal: d.pad }}>{children}</View>
    </View>
  );
}

export function Card({ tone = 'surface', style, children }) {
  const { theme, d } = useHomeStyle();
  const bg = { surface: theme.surface, soft: theme.soft, hero: theme.hero }[tone];
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: d.radius,
          padding: d.cardPad,
          // Light shadow on light themes only
          ...(theme.dark || tone !== 'surface'
            ? null
            : {
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Horizontal, swipeable row of cards (Netflix-style). Next card peeks in from the right.
export function Carousel({ children, widthRatio = 0.72 }) {
  const { d } = useHomeStyle();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(width, 480) * widthRatio);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + d.gap}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: d.pad, gap: d.gap }}
    >
      {items.map((child, i) => (
        <View key={i} style={{ width: cardWidth }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
}

// Progress bar. `on="hero"` when it sits on the hero card.
export function Bar({ value, on = 'bg', height = 8, style }) {
  const { theme } = useHomeStyle();
  const pct = Math.max(0, Math.min(1, value));
  const onHero = on === 'hero';
  return (
    <View style={[{ height, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <View
        style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: onHero ? theme.heroText : theme.track,
          opacity: onHero ? 0.25 : 1,
        }}
      />
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: onHero ? theme.heroBar : theme.accent,
        }}
      />
    </View>
  );
}

// Half-circle gauge for the daily spending goal.
export function Gauge({ value, size = 180, stroke = 16, on = 'bg', children }) {
  const { theme } = useHomeStyle();
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const height = size / 2 + stroke / 2;
  const angle = Math.PI * pct;
  const endX = cx - r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const onHero = on === 'hero';
  return (
    <View style={{ width: size, height, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Svg width={size} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke={onHero ? theme.heroText : theme.track}
          strokeOpacity={onHero ? 0.25 : 1}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        {pct > 0 ? (
          <Path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
            stroke={onHero ? theme.heroBar : theme.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

// Row with label on the left and value on the right (transactions, bills, etc.)
export function Row({ title, subtitle, value, on = 'bg', divider }) {
  const { theme, d } = useHomeStyle();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: d.gap,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: on === 'hero' ? 'rgba(0,0,0,0.08)' : theme.track,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <T on={on} bold>{title}</T>
        {subtitle ? <T v="small" on={on} muted>{subtitle}</T> : null}
      </View>
      <T on={on} bold>{value}</T>
    </View>
  );
}
