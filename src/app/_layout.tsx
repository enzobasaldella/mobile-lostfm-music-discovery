import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Both routes share a safe area and hide native navigation headers. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
