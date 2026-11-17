import React, { useState } from 'react';
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './screens/HomeScreen';
import AccountsScreen from './screens/AccountsScreen';
import SearchScreen from './screens/SearchScreen';
import PaymentsScreen from './screens/PaymentsScreen';
import MoreScreen from './screens/MoreScreen';
import SignInScreen from './screens/SignInScreen';
import GlassTabBar from './components/GlassTabBar';
import { useUser } from './src/session';
import { loadFromDatabase } from './src/personalise/store';
import ActionAlert from './src/actions/ActionAlert';
import { startActionPolling } from './src/actions/store';
import { navigate, useRoute } from './src/navigation';

const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'Accounts', icon: 'wallet-outline' },
  { name: 'Payments', icon: 'logo-usd', center: true },
  { name: 'Search', icon: 'search-outline' },
  { name: 'More', icon: 'ellipsis-horizontal' },
];

const SCREENS = {
  Home: HomeScreen,
  Accounts: AccountsScreen,
  Search: SearchScreen,
  Payments: PaymentsScreen,
  More: MoreScreen,
};

export default function App() {
  // Signing in loads the user's saved theme and home widgets (src/session.js).
  const user = useUser();

  return (
    <SafeAreaProvider>
      {user ? (
        <Tabs />
      ) : (
        <>
          <StatusBar style="light" />
          <SignInScreen />
        </>
      )}
    </SafeAreaProvider>
  );
}

// Remounts on every sign-in, so each user starts on Home.
function Tabs() {
  const [activeTab, setActiveTab] = useState('Home');
  const Screen = SCREENS[activeTab] ?? HomeScreen;

  // Tab (and sub-screen) live in src/navigation.js so other screens can navigate, e.g. Home -> More > Actions.
  const { tab: activeTab } = useRoute();
  const Screen = SCREENS[activeTab] ?? HomeScreen;

  // Restore the saved theme and home widgets (needs `npm run db`; without it the app starts fresh).
  useEffect(() => {
    loadFromDatabase();
    // Loads Actions and re-checks them every minute for the "about to run" alert.
    startActionPolling();
  }, []);

  return (
    <>
      <StatusBar style={activeTab === 'Home' ? 'light' : 'dark'} />
      <View style={styles.container}>
        <View style={styles.screenContainer}>
          <Screen />
        </View>

        {/* Floats over the screens; screens pad their bottom with useTabBarSpace() */}
        <GlassTabBar tabs={TABS} activeTab={activeTab} onSelect={(tab) => navigate(tab)} />

        {/* "Action runs tomorrow at 9am" notification with skip / delete / edit */}
        <ActionAlert />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  screenContainer: { flex: 1 },
});
