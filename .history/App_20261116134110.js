import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import ActivityScreen from './screens/ActivityScreen';
import WidgetScreen from './screens/WidgetScreen';
import ProfileScreen from './screens/ProfileScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home': return <HomeScreen />;
      case 'Activity': return <ActivityScreen />;
      case 'Search': return <SearchScreen />;
      case 'Widget': return <WidgetScreen />;
      case 'Profile': return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      <View style={styles.tabBar}>
        {[
          { name: 'Home', icon: 'home' },
          { name: 'Activity', icon: 'stats-chart' },
          {name: 'Search:', icon: 'magnifying-glass'},
          { name: 'Widget', icon: 'apps' },
          { name: 'Profile', icon: 'person' },
        ].map((tab) => (
          <TouchableOpacity key={tab.name} style={styles.tab} onPress={() => setActiveTab(tab.name)}>
            <Ionicons
              name={tab.icon}
              size={22}
              color={activeTab === tab.name ? '#D5002B' : '#6B7280'}
            />
            <Text style={[styles.tabText, activeTab === tab.name && styles.activeTabText]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  screenContainer: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  activeTabText: { color: '#D5002B', fontWeight: '700' },
});
