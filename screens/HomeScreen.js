import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AssistantSheet from '../src/voice/AssistantSheet';

// Brand colours used across the mockup
const RED = '#D5002B';
const NAVY = '#1F1C4F';
const PURPLE = '#8A2BE2';

// Mock data – swap for real data / API later
const ACCOUNTS = [
  { id: 'choice', name: 'Westpac Choice', balance: 469.3 },
  { id: 'life', name: 'Westpac Life', balance: 15780.4 },
  {
    id: 'altitude',
    name: 'Altitude Black\nMastercard',
    balance: -3469.01,
    available: 14469.95,
    rewardPoints: 10469,
    dueText: 'Min of $46.30 due tomorrow',
  },
];

const formatMoney = (n) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Read-only account summary shared with the AI assistant (names and balances only, per ai_perms.md)
const ACCOUNT_SUMMARY = ACCOUNTS.map(
  (a) =>
    `${a.name.replace('\n', ' ')}: balance ${formatMoney(a.balance)}` +
    (a.available != null ? `, available ${formatMoney(a.available)}` : '') +
    (a.dueText ? `, ${a.dueText}` : ''),
).join('\n');

function Header({ onAsk, onVoice }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      {/* Diagonal colour blocks behind the header */}
      <View style={styles.navyShape} />
      <View style={styles.purpleShape} />

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>W</Text>
          <TouchableOpacity>
            <Text style={styles.headerLink}>Contact us</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Text style={styles.headerLink}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>HOW CAN WE HELP YOU TODAY?</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search or ask your banking"
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (!query.trim()) return;
            onAsk(query.trim());
            setQuery('');
          }}
        />
        {/* Voice: opens the AI assistant and starts listening */}
        <TouchableOpacity onPress={onVoice} accessibilityLabel="Ask by voice" hitSlop={8}>
          <Ionicons name="mic" size={22} color={RED} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AccountCard({ account }) {
  const { name, balance, available, rewardPoints, dueText } = account;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{name}</Text>
        <View style={styles.cardRight}>
          <Text style={styles.cardBalance}>{formatMoney(balance)}</Text>
          {available != null && (
            <Text style={styles.cardMeta}>avail {formatMoney(available)}</Text>
          )}
          {rewardPoints != null && (
            <Text style={styles.cardMeta}>
              {rewardPoints.toLocaleString('en-AU')} reward points
            </Text>
          )}
        </View>
      </View>

      {dueText && (
        <View style={styles.cardFooter}>
          <Text style={styles.dueText}>{dueText}</Text>
          <TouchableOpacity style={styles.payButton}>
            <Text style={styles.payButtonText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  // AI assistant pop-up: `question` is set when opened from typed text, `listen` when opened by the mic.
  const [assistant, setAssistant] = useState(null); // null | { question } | { listen: true }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Header
        onAsk={(question) => setAssistant({ question })}
        onVoice={() => setAssistant({ listen: true })}
      />
      <AssistantSheet
        visible={assistant != null}
        onClose={() => setAssistant(null)}
        initialQuestion={assistant?.question}
        autoListen={assistant?.listen}
        context={ACCOUNT_SUMMARY}
      />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Accounts</Text>
          <TouchableOpacity>
            <Text style={styles.redLink}>New account</Text>
          </TouchableOpacity>
        </View>

        {ACCOUNTS.map((a) => (
          <AccountCard key={a.id} account={a} />
        ))}

        <View style={styles.panelFooter}>
          <TouchableOpacity>
            <Text style={styles.redLink}>2 hidden accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="settings" size={22} color={RED} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: {
    backgroundColor: RED,
    paddingHorizontal: 20,
    paddingBottom: 60, // room for the panel to overlap
    overflow: 'hidden',
  },
  navyShape: {
    position: 'absolute',
    top: -120,
    right: -140,
    width: 300,
    height: 300,
    backgroundColor: NAVY,
    transform: [{ rotate: '45deg' }],
  },
  purpleShape: {
    position: 'absolute',
    bottom: -200,
    right: -150,
    width: 320,
    height: 320,
    backgroundColor: PURPLE,
    transform: [{ rotate: '35deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  logo: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -2 },
  headerLink: { color: '#fff', fontSize: 16 },
  heading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 48,
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },

  // Accounts panel
  panel: {
    backgroundColor: '#F9FAFB',
    marginTop: -36,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: { fontSize: 18, fontWeight: '700', color: NAVY },
  redLink: { color: RED, fontSize: 14 },
  panelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },

  // Account card
  card: {
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 76,
  },
  cardName: { fontSize: 16, color: '#111827', flexShrink: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardBalance: { fontSize: 17, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dueText: { fontSize: 13, color: '#4B5563' },
  payButton: {
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  payButtonText: { color: '#111827', fontSize: 13 },
});
