// Home screen card for Actions: the next automation coming up, or a prompt to set one up.
// Tapping it opens More > Actions. `colors` lets the personalised home theme it.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { navigate } from '../navigation';
import { formatDay, runTime } from './rules';
import { useActions } from './store';

const DEFAULT_COLORS = { surface: '#FFFFFF', text: '#111827', muted: '#6B7280', accent: '#D5002B' };

export default function ActionsCard({ colors = DEFAULT_COLORS, style }) {
  const { actions } = useActions();
  const c = { ...DEFAULT_COLORS, ...colors };
  const next = [...actions].sort((a, b) => runTime(a.nextRun) - runTime(b.nextRun))[0];

  return (
    <Pressable
      onPress={() => navigate('More', 'Actions')}
      accessibilityRole="button"
      accessibilityLabel="Open Actions"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: c.surface,
          borderRadius: 12,
          padding: 14,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flash" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
          {actions.length ? `Actions · ${actions.length} running` : 'Actions'}
        </Text>
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }} numberOfLines={2}>
          {next
            ? `Next ${formatDay(next.nextRun)} at 9am: ${next.description}`
            : 'Automate your money, e.g. move anything over $500 to savings each week.'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.muted} />
    </Pressable>
  );
}
