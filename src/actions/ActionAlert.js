// In-app notification shown on every screen when an action is about to run (within 24 hours of its 9am run).
// Options: skip this week, delete the automation, or edit it. The ✕ lets it run as planned.
// Rendered once in App.js, above the screens.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRoute } from '../navigation';
import ActionForm, { NAVY, RED } from './ActionForm';
import { formatDay, needsAlert, runTime, skipLabel } from './rules';
import { deleteAction, dismissActionAlert, skipAction, useActions } from './store';

export default function ActionAlert() {
  const insets = useSafeAreaInsets();
  const { actions } = useActions();
  // The Actions page already shows skip / edit / delete on every action, so don't cover it.
  const onActionsPage = useRoute().screen === 'Actions';
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  // The soonest action due within the alert window (the list refreshes every minute).
  const action = actions.filter((a) => needsAlert(a)).sort((a, b) => runTime(a.nextRun) - runTime(b.nextRun))[0];

  const act = (label, fn) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      setConfirmDelete(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {action && !editing && !onActionsPage && (
        <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.banner} accessibilityRole="alert">
            <View style={styles.head}>
              <View style={styles.bell}>
                <Ionicons name="notifications" size={16} color="#fff" />
              </View>
              <Text style={styles.heading}>Action runs {formatDay(action.nextRun)} at 9am</Text>
              <Pressable
                onPress={act('dismiss', () => dismissActionAlert(action.id))}
                hitSlop={12}
                accessibilityLabel="Let it run and hide this alert"
              >
                <Ionicons name="close" size={20} color={NAVY} />
              </Pressable>
            </View>
            <Text style={styles.description}>{action.description}</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.buttons}>
              <Option
                label={skipLabel(action.frequency)}
                icon="play-skip-forward"
                busy={busy === 'skip'}
                onPress={act('skip', () => skipAction(action.id))}
              />
              <Option
                label={confirmDelete ? 'Confirm delete' : 'Delete automation'}
                icon="trash"
                danger
                busy={busy === 'delete'}
                onPress={confirmDelete ? act('delete', () => deleteAction(action.id)) : () => setConfirmDelete(true)}
              />
              <Option label="Edit" icon="create" onPress={() => setEditing(action)} />
            </View>
          </View>
        </View>
      )}
      <ActionForm visible={editing != null} action={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function Option({ label, icon, onPress, danger, busy }) {
  const color = danger ? RED : NAVY;
  return (
    <Pressable style={[styles.option, danger && { borderColor: '#FCA5A5' }]} onPress={onPress} disabled={busy} accessibilityRole="button">
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={14} color={color} />}
      <Text style={[styles.optionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  banner: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderLeftWidth: 4,
    borderLeftColor: RED,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bell: { width: 26, height: 26, borderRadius: 13, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontSize: 14, fontWeight: '700', color: NAVY },
  description: { fontSize: 14, color: '#111827' },
  error: { color: '#B00020', fontSize: 13 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  option: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  optionText: { fontSize: 13, fontWeight: '700' },
});
