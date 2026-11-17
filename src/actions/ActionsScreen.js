// "Actions" page (opened from More, or the Actions card on Home): list, add, edit, skip, run and delete
// money automations. New ones can be set up by asking the AI or with the form.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '../../components/GlassTabBar';
import AssistantSheet from '../voice/AssistantSheet';
import ActionForm, { NAVY, RED } from './ActionForm';
import { actionTools } from './assistantTools';
import { describeSchedule, money, needsAlert, skipLabel } from './rules';
import { deleteAction, runActionNow, skipAction, useActions } from './store';

const RUN_TEXT = {
  moved: (r) => `Moved ${money(r.amount)}`,
  nothing: () => 'Nothing to move',
  skipped: () => 'Skipped',
  failed: () => "Couldn't run",
};

function lastRunText(run) {
  if (!run) return 'Not run yet';
  if (run.status === 'skipped') return `Last: ${run.note ?? 'Skipped'}`;
  const [y, m, d] = run.date.split('-');
  return `Last: ${RUN_TEXT[run.status](run)} on ${d}/${m}/${y}${run.note ? ` · ${run.note}` : ''}`;
}

function ActionItem({ action, onEdit }) {
  const [busy, setBusy] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState(null);

  const act = (label, fn) => async () => {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fn();
      if (res?.result) setMessage(`${RUN_TEXT[res.result.status](res.result)}${res.result.note ? `: ${res.result.note}` : ''}`);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  };

  const soon = needsAlert(action) || action.alertDismissedFor === action.nextRun;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Ionicons name="flash" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.description}>{action.description}</Text>
          <Text style={[styles.meta, soon && { color: RED, fontWeight: '600' }]}>{describeSchedule(action)}</Text>
          <Text style={styles.meta}>{lastRunText(action.lastRun)}</Text>
          {action.createdBy === 'ai' && <Text style={styles.badge}>Set up with the AI assistant</Text>}
        </View>
      </View>

      {message && <Text style={styles.message}>{message}</Text>}

      <View style={styles.buttons}>
        <SmallButton icon="create-outline" label="Edit" onPress={() => onEdit(action)} />
        <SmallButton icon="play-skip-forward-outline" label={skipLabel(action.frequency)} busy={busy === 'skip'} onPress={act('skip', () => skipAction(action.id))} />
        <SmallButton icon="play-outline" label="Run now" busy={busy === 'run'} onPress={act('run', () => runActionNow(action.id))} />
        <SmallButton
          icon="trash-outline"
          label={confirmDelete ? 'Tap to confirm' : 'Delete'}
          danger
          busy={busy === 'delete'}
          onPress={confirmDelete ? act('delete', () => deleteAction(action.id)) : () => setConfirmDelete(true)}
        />
      </View>
    </View>
  );
}

function SmallButton({ icon, label, onPress, danger, busy }) {
  const color = danger ? RED : NAVY;
  return (
    <Pressable style={[styles.smallButton, danger && { borderColor: '#FCA5A5' }]} onPress={onPress} disabled={busy} accessibilityRole="button">
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={15} color={color} />}
      <Text style={[styles.smallButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function ActionsScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const { actions, loaded, error } = useActions();
  const [editing, setEditing] = useState(null); // null | { action: existing or null }
  const [asking, setAsking] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabBarSpace, paddingHorizontal: 16, gap: 14 }}>
        <View style={styles.titleRow}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={NAVY} />
            </Pressable>
          )}
          <Text style={styles.title}>Actions</Text>
        </View>
        <Text style={styles.intro}>
          Automate your money between your own accounts. Actions run at 9am, and we'll let you know the day before so
          you can skip, edit or delete them.
        </Text>

        <View style={styles.addRow}>
          <Pressable style={[styles.addButton, { backgroundColor: RED }]} onPress={() => setAsking(true)}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.addText}>Ask the AI</Text>
          </Pressable>
          <Pressable style={[styles.addButton, { backgroundColor: NAVY }]} onPress={() => setEditing({ action: null })}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>New action</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {!loaded && <ActivityIndicator color={NAVY} />}
        {loaded && !error && actions.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={28} color={NAVY} />
            <Text style={styles.emptyTitle}>No actions yet</Text>
            <Text style={styles.emptyText}>
              Try asking the AI: "If my Choice account has more than $500, move the extra to my savings every week."
            </Text>
          </View>
        )}
        {actions.map((a) => (
          <ActionItem key={a.id} action={a} onEdit={(action) => setEditing({ action })} />
        ))}
      </ScrollView>

      <ActionForm visible={editing != null} action={editing?.action} onClose={() => setEditing(null)} />
      <AssistantSheet
        visible={asking}
        onClose={() => setAsking(false)}
        tools={actionTools.tools}
        getContext={actionTools.context}
        hint={'Tell me what to automate, e.g. "If my Choice account has more than $500, move the extra to my savings every week."'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: NAVY },
  intro: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  addRow: { flexDirection: 'row', gap: 10 },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 10,
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#B00020' },
  empty: { alignItems: 'center', gap: 6, padding: 24, backgroundColor: '#fff', borderRadius: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: NAVY },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  description: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 13, color: '#6B7280' },
  badge: { fontSize: 12, color: NAVY, fontStyle: 'italic' },
  message: { fontSize: 13, color: NAVY, backgroundColor: '#EEF2FF', padding: 8, borderRadius: 6 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { fontSize: 13, fontWeight: '600' },
});
