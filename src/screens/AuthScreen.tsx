import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { BrandWordmark } from '../components/Brand';
import { colors, fontFamily, spacing } from '../theme';

type Mode = 'login' | 'register';

/** Firebase owns the credentials; this screen only collects them. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Configure Google's native sign-in with the project's OAuth Web client ID.
  useEffect(() => {
    const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
    if (webClientId) GoogleSignin.configure({ webClientId });
  }, []);

  /** Register or sign in with Firebase according to the selected form mode. */
  async function submitEmail() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      else await signInWithEmailAndPassword(getAuth(), email.trim(), password);
    } catch (error) {
      Alert.alert(mode === 'register' ? 'Could not create account' : 'Could not sign in', readableAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  /** Exchange the Google ID token for a Firebase credential and shared session. */
  async function signInWithGoogle() {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return;
      const idToken = result.data.idToken;
      if (!idToken) throw new Error('Google did not return an authentication token.');
      await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
    } catch (error) {
      Alert.alert('Google sign-in failed', readableAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.brand}><BrandWordmark width={178} /></View>
        <View style={styles.form}>
          <Text style={styles.heading}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" selectionColor={colors.text} />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'password'} textContentType={mode === 'register' ? 'newPassword' : 'password'} selectionColor={colors.text} onSubmitEditing={submitEmail} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={submitEmail} style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}>
            {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>}
          </Pressable>
          <View style={styles.divider}><View style={styles.rule} /><Text style={styles.or}>OR</Text><View style={styles.rule} /></View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={signInWithGoogle} style={({ pressed }) => [styles.googleButton, (pressed || busy) && styles.pressed]}>
            <Image source={require('../../assets/google-g.png')} style={styles.googleIcon} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={styles.switch}>
            <Text style={styles.switchText}>{mode === 'login' ? 'New here?  ' : 'Already have an account?  '}<Text style={styles.switchAction}>{mode === 'login' ? 'Create account' : 'Sign in'}</Text></Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Convert common Firebase error codes into useful messages for the form. */
function readableAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Use a password with at least six characters.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/network-request-failed': 'Check your connection and try again.',
  };
  return messages[code ?? ''] ?? (error instanceof Error ? error.message : 'Please try again.');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 48, paddingBottom: 24 },
  brand: { alignItems: 'center', marginTop: 12 },
  form: { flex: 1, justifyContent: 'center', maxWidth: 420, width: '100%', alignSelf: 'center' },
  heading: { color: colors.text, fontFamily, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, marginBottom: 30 },
  label: { color: colors.muted, fontFamily, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  input: { color: colors.text, fontFamily, fontSize: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 5, height: 54, paddingHorizontal: 16, marginBottom: 23 },
  primaryButton: { backgroundColor: colors.text, borderRadius: 5, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: colors.background, fontFamily, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 23 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.subtle, fontFamily, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  googleButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 5, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  googleIcon: { width: 18, height: 18 },
  googleText: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '600' },
  switch: { alignItems: 'center', paddingTop: 29, paddingBottom: 8 },
  switchText: { color: colors.muted, fontFamily, fontSize: 13 },
  switchAction: { color: colors.text, fontWeight: '700' },
});
