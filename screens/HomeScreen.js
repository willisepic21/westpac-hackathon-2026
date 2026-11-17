import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import WestpacLogo from '../components/WestpacLogo';
import ActionsCard from '../src/actions/ActionsCard';
import { actionTools } from '../src/actions/assistantTools';
import AssistantSheet from '../src/voice/AssistantSheet';
import PersonalisedHome, { HomeWidgets } from '../src/personalise/PersonalisedHome';
import QuestionSheet from '../src/personalise/QuestionSheet';
import { buildHome, buildStandardHome } from '../src/personalise/buildHome';
import { HomeStyleProvider } from '../src/personalise/ui';
import {
  usePersonalisation,
  setPersonalisation,
  getPersonalisation,
  setHomeSections,
  setTheme,
  getCatalog,
} from '../src/personalise/store';
import { createHomeTools } from '../src/personalise/homeTools';
import { useTabBarSpace } from '../components/GlassTabBar';
import { signOut } from '../src/session';

// Brand colours used across the mockup
const RED = '#D5002B';
const NAVY = '#1F1C4F';

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
          <WestpacLogo width={64} color="#fff" />
          <TouchableOpacity>
            <Text style={styles.headerLink}>Contact us</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={signOut}>
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

export default function HomeScreen() {
  // AI assistant pop-up: `question` is set when opened from typed text, `listen` when opened by the mic.
  const [assistant, setAssistant] = useState(null); // null | { question } | { listen: true }

  // Personalised home: finalised answers from the question pop-up (null = standard home)
  const personal = usePersonalisation();
  const [editing, setEditing] = useState(false);
  const home = useMemo(
    () => (personal ? buildHome(personal.answers, { sections: personal.sections }) : null),
    [personal],
  );
  // Lets the assistant see the widgets on Home, add / remove / move them, and change the theme.
  // ...and set up / change / delete Actions (money automations), which the user approves first.
  const homeTools = useMemo(() => {
    const home = createHomeTools({ getState: getPersonalisation, setSections: setHomeSections, setTheme, getCatalog });
    return {
      tools: [...home.tools, ...actionTools.tools],
      context: async () => `${await home.context()}\n\n${await actionTools.context()}`,
    };
  }, []);

  const onAsk = (question) => setAssistant({ question });
  const onVoice = () => setAssistant({ listen: true });

  const sheets = (
    <>
      <AssistantSheet
        visible={assistant != null}
        onClose={() => setAssistant(null)}
        initialQuestion={assistant?.question}
        autoListen={assistant?.listen}
        tools={homeTools.tools}
        getContext={homeTools.context}
      />
      <QuestionSheet
        visible={editing}
        initialAnswers={personal?.answers}
        onClose={() => setEditing(false)}
        onFinalise={(answers) => {
          setPersonalisation(answers);
          setEditing(false);
        }}
        onReset={
          personal
            ? () => {
                setPersonalisation(null);
                setEditing(false);
              }
            : undefined
        }
      />
    </>
  );

  // The sheets stay in one place in the tree, so an AI widget edit that switches the standard home
  // to the personalised one doesn't remount (and close) the assistant mid-conversation.
  return (
    <View style={{ flex: 1 }}>
      {home ? (
        <PersonalisedHome home={home} onEdit={() => setEditing(true)} onAsk={onAsk} onVoice={onVoice} />
      ) : (
        <StandardHome onAsk={onAsk} onVoice={onVoice} onPersonalise={() => setEditing(true)} />
      )}
      {sheets}
    </View>
  );
}

// No saved widgets: the Westpac header, the "Make this home yours" banner, then every widget.
function StandardHome({ onAsk, onVoice, onPersonalise }) {
  const tabBarSpace = useTabBarSpace();
  const home = useMemo(buildStandardHome, []);
  const { theme, d } = home;
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ paddingBottom: tabBarSpace }}>
      <Header onAsk={onAsk} onVoice={onVoice} />

      <View style={[styles.panel, { backgroundColor: theme.bg }]}>
        <TouchableOpacity style={styles.personaliseCard} onPress={onPersonalise} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.personaliseTitle}>Make this home yours</Text>
            <Text style={styles.personaliseText}>Answer 7 quick questions and we'll build your home around your goals.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <ActionsCard style={{ marginHorizontal: 16, marginTop: 18 }} />

        <HomeStyleProvider value={{ theme, d, home }}>
          <HomeWidgets home={home} />
        </HomeStyleProvider>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // "Make this home yours" banner that opens the question pop-up
  personaliseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: NAVY,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
  },
  personaliseTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  personaliseText: { color: '#D9D6E6', fontSize: 13, marginTop: 2 },

  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: {
    backgroundImage: "linear-gradient(45deg, #ff0000, #0046ff)",
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
    backgroundColor: RED,
    transform: [{ rotate: '35deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
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

  // Panel under the header: the banner, then the widgets (which pad themselves)
  panel: {
    marginTop: -36,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
});
