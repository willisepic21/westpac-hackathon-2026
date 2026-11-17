// Pop-up form to create or edit an action.
//   <ActionForm visible action={existingOrNull} onClose={() => ...} />

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREQUENCIES, KINDS, describeAction, normaliseAction } from './rules';
import { createAction, nameOf, updateAction, useActions } from './store';

export const RED = '#D5002B';
export const NAVY = '#1F1C4F';

const KIND_HELP = {
  sweep: 'Keep a set amount in one account and move anything over it.',
  top_up: 'Keep an account from dropping below a minimum.',
  transfer: 'Move the same amount every time.',
};

function Chips({ options, value, onChange, label = (o) => o }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const key = typeof o === 'object' ? o.id : o;
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const capital = (s) => s[0].toUpperCase() + s.slice(1);

export default function ActionForm({ visible, action, onClose }) {
  const insets = useSafeAreaInsets();
  const { accounts } = useActions();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fill the form each time it opens.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setForm({
      kind: action?.kind ?? 'sweep',
      from: action?.from ?? accounts[0]?.id,
      to: action?.to ?? accounts[1]?.id,
      value: String(action?.threshold ?? action?.amount ?? ''),
      frequency: action?.frequency ?? 'weekly',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, action?.id]);

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const usesAmount = KINDS[form.kind].needs === 'amount';
  const input = {
    kind: form.kind,
    from: form.from,
    to: form.to,
    frequency: form.frequency,
    [usesAmount ? 'amount' : 'threshold']: form.value,
    nextRun: action?.nextRun,
  };

  let preview = null;
  try {
    preview = describeAction(normaliseAction(input, accounts), (id) => nameOf(accounts, id));
  } catch {
    // shown as an error on save
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      normaliseAction(input, accounts); // same checks as the server, with friendlier timing
      if (action) await updateAction(action.id, input);
      else await createAction(input);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const valueLabel = usesAmount ? 'Amount' : form.kind === 'sweep' ? 'Keep this much in it' : 'Minimum balance';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{action ? 'Edit action' : 'New action'}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={NAVY} />
            </Pressable>
          </View>

          {accounts.length < 2 ? (
            <Text style={styles.error}>You need at least two accounts (and the database running) to set up an action.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 6, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Type</Text>
              <Chips options={Object.keys(KINDS)} value={form.kind} onChange={(kind) => set({ kind })} label={(k) => KINDS[k].label} />
              <Text style={styles.help}>{KIND_HELP[form.kind]}</Text>

              <Text style={styles.label}>{form.kind === 'top_up' ? 'Take money from' : 'From'}</Text>
              <Chips options={accounts} value={form.from} onChange={(from) => set({ from })} label={(a) => a.name} />

              <Text style={styles.label}>{form.kind === 'top_up' ? 'Account to keep topped up' : 'To'}</Text>
              <Chips options={accounts} value={form.to} onChange={(to) => set({ to })} label={(a) => a.name} />

              <Text style={styles.label}>{valueLabel}</Text>
              <View style={styles.moneyInput}>
                <Text style={styles.dollar}>$</Text>
                <TextInput
                  style={styles.input}
                  value={form.value}
                  onChangeText={(value) => set({ value: value.replace(/[^0-9.]/g, '') })}
                  keyboardType="decimal-pad"
                  placeholder="500"
                  placeholderTextColor="#9CA3AF"
                  accessibilityLabel={valueLabel}
                />
              </View>

              <Text style={styles.label}>How often</Text>
              <Chips options={FREQUENCIES} value={form.frequency} onChange={(frequency) => set({ frequency })} label={capital} />

              {preview && (
                <View style={styles.preview}>
                  <Ionicons name="flash" size={18} color={RED} />
                  <Text style={styles.previewText}>{preview}</Text>
                </View>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
          )}

          <Pressable style={[styles.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving || accounts.length < 2}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{action ? 'Save changes' : 'Set up action'}</Text>}
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', color: NAVY },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 10 },
  help: { fontSize: 13, color: '#6B7280' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { color: '#111827', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
  },
  dollar: { fontSize: 17, color: '#6B7280', marginRight: 4 },
  input: { flex: 1, fontSize: 17, color: '#111827' },
  preview: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  previewText: { flex: 1, color: '#111827', fontSize: 14 },
  error: { color: '#B00020', marginTop: 8 },
  save: { backgroundColor: RED, borderRadius: 8, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
