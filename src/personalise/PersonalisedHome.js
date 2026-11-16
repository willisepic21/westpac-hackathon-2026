// Renders a home built by buildHome(): themed header + the template's sections, top to bottom.

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import WestpacLogo from '../../components/WestpacLogo';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { HomeStyleProvider, T } from './ui';
import GoalSection from './widgets/GoalWidgets';
import MoveSection from './widgets/MoveMoney';
import {
  PinnedSection,
  TilesSection,
  WeeklySection,
  RecentSection,
  BillsSection,
  NetWorthSection,
  TotalSection,
} from './widgets/MoneyWidgets';

const SECTIONS = {
  goal: GoalSection,
  weekly: WeeklySection,
  pinned: PinnedSection,
  tiles: TilesSection,
  recent: RecentSection,
  netWorth: NetWorthSection,
  bills: BillsSection,
  move: MoveSection,
  total: TotalSection,
};

// Compact search / ask bar that opens the AI assistant, same as the standard home.
function AskBar({ theme, d, onAsk, onVoice }) {
  const [query, setQuery] = useState('');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.surface,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 44,
        marginTop: d.gap + 4,
      }}
    >
      <Ionicons name="search" size={18} color={theme.muted} />
      <TextInput
        style={{ flex: 1, fontSize: d.body, color: theme.text }}
        placeholder="Search or ask your banking"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => {
          if (!query.trim()) return;
          onAsk(query.trim());
          setQuery('');
        }}
      />
      <TouchableOpacity onPress={onVoice} accessibilityLabel="Ask by voice" hitSlop={8}>
        <Ionicons name="mic" size={20} color={theme.link} />
      </TouchableOpacity>
    </View>
  );
}

export default function PersonalisedHome({ home, onEdit, onAsk, onVoice }) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { theme, d, template } = home;

  return (
    <HomeStyleProvider value={{ theme, d, home }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabBarSpace }}
      >
        <View style={{ paddingHorizontal: d.pad }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <WestpacLogo width={44} color={theme.dark ? theme.text : theme.link} />
            <TouchableOpacity onPress={onEdit} hitSlop={8} accessibilityLabel="Edit home">
              <Text style={{ color: theme.link, fontSize: d.small, fontWeight: '600' }}>Edit home</Text>
            </TouchableOpacity>
          </View>
          <T v="title" style={{ marginTop: d.gap + 6 }}>{template.title}</T>
          <T v="small" muted style={{ marginTop: 4 }}>{home.tags}</T>
          <AskBar theme={theme} d={d} onAsk={onAsk} onVoice={onVoice} />
        </View>

        {home.sections.map((section, i) => {
          const Widget = SECTIONS[section.type];
          return Widget ? <Widget key={`${section.type}-${i}`} section={section} home={home} /> : null;
        })}
      </ScrollView>
    </HomeStyleProvider>
  );
}
