// Approval card shown inside the AI assistant when the AI proposes a new or changed action.
// Nothing is saved until the user taps Approve (ai_perms.md: automations need an approved prompt).

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { NAVY, RED } from './ActionForm';
import { approveProposal, declineProposal, usePendingProposal } from './store';

export default function ProposalCard() {
  const proposal = usePendingProposal();
  const [saving, setSaving] = useState(false);
  if (!proposal) return null;

  const approve = async () => {
    setSaving(true);
    await approveProposal();
    setSaving(false);
  };

  return (
    <View style={styles.card} accessibilityLabel="Approve this action">
      <View style={styles.head}>
        <Ionicons name="flash" size={16} color={RED} />
        <Text style={styles.heading}>{proposal.editId != null ? 'Approve this change?' : 'Approve this action?'}</Text>
      </View>
      <Text style={styles.description}>{proposal.description}</Text>
      <Text style={styles.schedule}>{proposal.schedule}</Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.decline]} onPress={declineProposal} disabled={saving}>
          <Text style={[styles.buttonText, { color: NAVY }]}>Decline</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.approve]} onPress={approve} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { color: '#fff' }]}>Approve</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 14, fontWeight: '700', color: NAVY },
  description: { fontSize: 15, color: '#111827' },
  schedule: { fontSize: 13, color: '#6B7280' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  decline: { borderWidth: 1, borderColor: '#D1D5DB' },
  approve: { backgroundColor: RED },
  buttonText: { fontWeight: '700', fontSize: 14 },
});
