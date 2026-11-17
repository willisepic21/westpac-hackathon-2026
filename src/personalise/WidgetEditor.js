// "Customise" pop-up: the user reorders, removes, adds and restyles Home widgets themselves
// (the same changes the AI assistant can make). Edits a draft; nothing changes until Save.
//
//   <WidgetEditor visible sections={home.sections} onSave={(sections) => setHomeSections(sections)} onClose={...} />

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  RECENT_COUNTS,
  VARIANT_LABELS,
  WIDGETS,
  editLayout,
  missingWidgets,
  moveSection,
  updateSection,
} from './widgetCatalog';

const RED = '#D5002B';
const NAVY = '#1F1C4F';

function IconButton({ icon, label, onPress, disabled, color = NAVY }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, disabled && { opacity: 0.3 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WidgetRow({ section, index, count, onChange }) {
  const [open, setOpen] = useState(false);
  const w = WIDGETS[section.type];
  const editable = w.variants.length > 1 || section.type === 'recent';
  const detail = [
    section.variant && VARIANT_LABELS[section.variant],
    section.type === 'recent' && `${section.count ?? 3} transactions`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.position}>{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{w.name}</Text>
          {!!detail && <Text style={styles.detail}>{detail}</Text>}
        </View>
        <IconButton icon="chevron-up" label={`Move ${w.name} up`} disabled={index === 0} onPress={() => onChange((l) => moveSection(l, index, -1))} />
        <IconButton icon="chevron-down" label={`Move ${w.name} down`} disabled={index === count - 1} onPress={() => onChange((l) => moveSection(l, index, 1))} />
        {editable && (
          <IconButton icon={open ? 'options' : 'options-outline'} label={`Edit ${w.name}`} onPress={() => setOpen((o) => !o)} />
        )}
        <IconButton
          icon="remove-circle-outline"
          label={`Remove ${w.name}`}
          color={RED}
          onPress={() => onChange((l) => editLayout(l, { action: 'remove', type: section.type }).sections)}
        />
      </View>

      {open && (
        <View style={styles.settings}>
          {w.variants.length > 1 && (
            <>
              <Text style={styles.settingLabel}>Style</Text>
              <View style={styles.chips}>
                {w.variants.map((v) => (
                  <Chip key={v} label={VARIANT_LABELS[v] ?? v} active={section.variant === v} onPress={() => onChange((l) => updateSection(l, index, { variant: v }))} />
                ))}
              </View>
            </>
          )}
          {section.type === 'recent' && (
            <>
              <Text style={styles.settingLabel}>How many</Text>
              <View style={styles.chips}>
                {RECENT_COUNTS.map((n) => (
                  <Chip key={n} label={String(n)} active={(section.count ?? 3) === n} onPress={() => onChange((l) => updateSection(l, index, { count: n }))} />
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default function WidgetEditor({ visible, sections, onSave, onClose }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(sections);
  const [saving, setSaving] = useState(false);

  // Start from the live home each time it opens.
  useEffect(() => {
    if (visible) setDraft(sections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const missing = missingWidgets(draft);

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Customise home</Text>
            <Pressable onPress={save} disabled={saving} hitSlop={12} accessibilityRole="button" accessibilityLabel="Save widgets">
              {saving ? <ActivityIndicator color={RED} /> : <Text style={styles.save}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            <Text style={styles.sectionTitle}>On your home</Text>
            {draft.length === 0 && <Text style={styles.empty}>No widgets. Add some below.</Text>}
            {draft.map((s, i) => (
              <WidgetRow key={s.type} section={s} index={i} count={draft.length} onChange={setDraft} />
            ))}

            {missing.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Add widgets</Text>
                {missing.map((type) => (
                  <Pressable
                    key={type}
                    style={styles.addRow}
                    onPress={() => setDraft((l) => editLayout(l, { action: 'add', type }).sections)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${WIDGETS[type].name}`}
                  >
                    <Ionicons name="add-circle" size={22} color={RED} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{WIDGETS[type].name}</Text>
                      <Text style={styles.detail}>{WIDGETS[type].description}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: NAVY },
  cancel: { fontSize: 16, color: '#4B5563' },
  save: { fontSize: 16, fontWeight: '700', color: RED },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: '#6B7280' },
  row: { backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  position: { width: 22, textAlign: 'center', color: '#9CA3AF', fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  detail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  settings: { marginTop: 8, marginLeft: 26, gap: 6 },
  settingLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontSize: 13, color: '#111827' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12 },
});
