import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BrandWordmark } from './Brand';
import { colors } from '../theme';

/** Hold the screen while Firebase resolves the current authentication state. */
export function SessionLoader() {
  return (
    <View style={styles.container}>
      <BrandWordmark width={160} />
      <ActivityIndicator color={colors.text} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: colors.background },
});
