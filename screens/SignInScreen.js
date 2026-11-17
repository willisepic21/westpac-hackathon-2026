import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import WestpacLogo from '../components/WestpacLogo';
import { signIn } from '../src/session';

const RED = '#D5002B';
const NAVY = '#1F1C4F';

// Customers seeded in database/app.db, so the demo can sign in with one tap.
const DEMO_EMAILS = ['will@example.com', 'mandeep@example.com', 'jeff@example.com'];

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = email.trim() && password && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim());
      // App.js swaps to the tabs once signed in, unmounting this screen.
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
          <View style={styles.navyShape} />
          <View style={styles.redShape} />
          <WestpacLogo width={88} color="#fff" />
          <Text style={styles.heading}>WELCOME BACK</Text>
          <Text style={styles.subheading}>Sign in to your Westpac banking</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputBox}>
            <Ionicons name="person-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((s) => !s)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={RED} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>

          {/* Demo: the database has no passwords yet, so any password works for these customers. */}
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Demo customers (any password)</Text>
            <View style={styles.demoRow}>
              {DEMO_EMAILS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={styles.chip}
                  onPress={() => {
                    setEmail(e);
                    setError(null);
                  }}
                >
                  <Text style={styles.chipText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Same gradient + diagonal blocks as the standard home header
  header: {
    backgroundImage: 'linear-gradient(45deg, #ff0000, #0046ff)',
    paddingHorizontal: 24,
    paddingBottom: 72,
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
  redShape: {
    position: 'absolute',
    bottom: -200,
    right: -150,
    width: 320,
    height: 320,
    backgroundColor: RED,
    transform: [{ rotate: '35deg' }],
  },
  heading: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 48, letterSpacing: 0.3 },
  subheading: { color: '#fff', fontSize: 16, marginTop: 6 },

  panel: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    marginTop: -36,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  label: { fontSize: 14, fontWeight: '600', color: NAVY, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 18,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },

  error: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  errorText: { color: RED, fontSize: 14, flexShrink: 1 },

  button: {
    backgroundColor: RED,
    borderRadius: 6,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  demo: { marginTop: 32 },
  demoTitle: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, color: NAVY },
});
