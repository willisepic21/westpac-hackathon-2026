import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import AccountsScreen from './screens/AccountsScreen';
import SearchScreen from './screens/SearchScreen';
import PaymentsScreen from './screens/PaymentsScreen';
import MoreScreen from './screens/MoreScreen';

const RED = '#D5002B';
const GREY = '#6B7280';

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

  return (
    <SafeAreaProvider>
      <StatusBar style={activeTab === 'Home' ? 'light' : 'dark'} />
      <View style={styles.container}>
        <View style={styles.screenContainer}>
          <Screen />
        </View>

        {/* Bottom inset only – screens handle their own top inset */}
        <SafeAreaView edges={['bottom']} style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.name;

              if (tab.center) {
                return (
                  <TouchableOpacity
                    key={tab.name}
                    style={styles.tab}
                    onPress={() => setActiveTab(tab.name)}
                  >
                    <View style={styles.centerButton}>
                      <Ionicons name={tab.icon} size={24} color="#fff" />
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tab}
                  onPress={() => setActiveTab(tab.name)}
                >
                  <Ionicons name={tab.icon} size={22} color={active ? RED : GREY} />
                  <Text style={[styles.tabText, active && styles.activeTabText]}>
                    {tab.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  screenContainer: { flex: 1 },
  tabBarWrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabText: { fontSize: 11, color: GREY, fontWeight: '500' },
  activeTabText: { color: '#111827', fontWeight: '700' },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
