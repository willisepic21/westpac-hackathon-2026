// Move-money widget (question 5):
//   to others → quick PayID contacts
//   to myself → 1-tap transfer, as a button or a slide-to-confirm slider
//   both      → both
// Transfers are mock only: nothing is sent, the widget just shows a confirmation.

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Section, Card, T, formatMoney, useHomeStyle } from '../ui';
import { CONTACTS, TRANSFERS } from '../mockData';

const money = (n) => formatMoney(n, { cents: false });

function Contacts() {
  const { theme, d } = useHomeStyle();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: d.gap }}>
      {CONTACTS.map((c) => (
        <TouchableOpacity
          key={c.id}
          accessibilityLabel={`Pay ${c.name} by PayID`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.soft,
            borderRadius: 999,
            paddingVertical: 8,
            paddingLeft: 8,
            paddingRight: 14,
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.onAccent, fontWeight: '700', fontSize: 12 }}>{c.name[0]}</Text>
          </View>
          <T v="small" bold>{c.name} · PayID</T>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Done({ transfer, onUndo }) {
  const { theme, d } = useHomeStyle();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.soft,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 18,
        marginTop: d.gap,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="checkmark-circle" size={20} color={theme.link} />
        <T bold>{money(transfer.amount)} moved to {transfer.to}</T>
      </View>
      <TouchableOpacity onPress={onUndo} hitSlop={8}>
        <T v="small" bold color={theme.link}>Undo</T>
      </TouchableOpacity>
    </View>
  );
}

function TransferButton({ transfer, onDone }) {
  const { theme, d } = useHomeStyle();
  return (
    <TouchableOpacity
      onPress={onDone}
      style={{
        backgroundColor: theme.accent,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: d.gap,
      }}
    >
      <T bold on="accent">Move {money(transfer.amount)} to {transfer.short} →</T>
    </TouchableOpacity>
  );
}

// Slide-to-confirm: drag the knob to the end to make the transfer.
const KNOB = 44;
const PAD = 4;

function TransferSlider({ transfer, onDone }) {
  const { theme, d } = useHomeStyle();
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, trackWidth - KNOB - PAD * 2);
  const maxRef = useRef(0);
  maxRef.current = max;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      // Stop the page / carousel from stealing the drag
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(maxRef.current, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (g.dx >= maxRef.current * 0.85) {
          Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
            onDone();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{
        height: KNOB + PAD * 2,
        borderRadius: 999,
        backgroundColor: theme.soft,
        justifyContent: 'center',
        marginTop: d.gap,
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Slide to move ${money(transfer.amount)} to ${transfer.to}`}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onDone}
    >
      <T bold style={{ position: 'absolute', left: KNOB + PAD * 2 + 12 }}>
        Slide to move {money(transfer.amount)}
      </T>
      <Animated.View
        {...responder.panHandlers}
        style={{
          position: 'absolute',
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
        }}
      >
        <Ionicons name="arrow-forward" size={20} color={theme.onAccent} />
      </Animated.View>
    </View>
  );
}

export default function MoveSection({ section, home }) {
  const { d } = useHomeStyle();
  const [done, setDone] = useState(false);
  const transfer = TRANSFERS[home.goal] ?? TRANSFERS.spending;

  const contacts = home.showContacts ? <Contacts /> : null;
  const self = home.showTransfer ? (
    <View style={{ marginTop: contacts ? d.section * 0.6 : 0 }}>
      <Card tone="surface">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <T bold>{transfer.from} → {transfer.to}</T>
            <T v="small" muted>Your usual transfer</T>
          </View>
          <T v="big">{money(transfer.amount)}</T>
        </View>
        {done ? (
          <Done transfer={transfer} onUndo={() => setDone(false)} />
        ) : section.variant === 'slider' ? (
          <TransferSlider transfer={transfer} onDone={() => setDone(true)} />
        ) : (
          <TransferButton transfer={transfer} onDone={() => setDone(true)} />
        )}
      </Card>
    </View>
  ) : null;

  // Template titles (e.g. "Keep the habit going") describe the self-transfer, so only use them when it shows.
  const title = home.showTransfer ? (section.title ?? 'Move money') : 'Send again';

  return (
    <Section title={title}>
      {contacts}
      {self}
    </Section>
  );
}
