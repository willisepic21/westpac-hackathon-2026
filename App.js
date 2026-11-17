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

// Shown once signed in (signIn() in src/session.js also loads the user's home and sends them to Home).
function Tabs() {
  // Tab (and sub-screen) live in src/navigation.js so other screens can navigate, e.g. Home -> More > Actions.
  const { tab: activeTab } = useRoute();
  const Screen = SCREENS[activeTab] ?? HomeScreen;

  useEffect(() => {
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
  // overflow: 'hidden' keeps anything oversized (e.g. a wallpaper image) from widening the page on web.
  container: { flex: 1, backgroundColor: '#F9FAFB', overflow: 'hidden' },
  screenContainer: { flex: 1 },
});
