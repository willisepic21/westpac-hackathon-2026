import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './screens/HomeScreen';
import AccountsScreen from './screens/AccountsScreen';
import SearchScreen from './screens/SearchScreen';
import PaymentsScreen from './screens/PaymentsScreen';
import MoreScreen from './screens/MoreScreen';
import GlassTabBar from './components/GlassTabBar';
import { loadFromDatabase } from './src/personalise/store';

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
  const [activeTab, setActiveTab] = useState('Home');
  const Screen = SCREENS[activeTab] ?? HomeScreen;

  // Restore the saved theme and home widgets (needs `npm run db`; without it the app starts fresh).
  useEffect(() => {
    loadFromDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={activeTab === 'Home' ? 'light' : 'dark'} />
      <View style={styles.container}>
        <View style={styles.screenContainer}>
          <Screen />
        </View>

        {/* Floats over the screens; screens pad their bottom with useTabBarSpace() */}
        <GlassTabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  screenContainer: { flex: 1 },
});
