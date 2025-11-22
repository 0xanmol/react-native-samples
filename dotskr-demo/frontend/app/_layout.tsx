import { Slot } from 'expo-router';
import { AppProviders } from '@/components/app-providers';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppProviders>
        <Slot />
        <StatusBar style="auto" />
      </AppProviders>
    </View>
  );
}
