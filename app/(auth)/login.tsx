import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { saveCredentials, clearCredentials } from '../../lib/secureAuth';
import { theme } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (rememberMe) {
        await saveCredentials(email, password);
      } else {
        await clearCredentials();
      }
      // _layout.tsx handles routing once firebaseUser is set
    } catch (e: any) {
      Alert.alert(
        'Sign in failed',
        e.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to Our Day</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.colors.ink4}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.colors.ink4}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <View style={styles.row}>
        <View style={styles.rememberWrap}>
          <Switch
            value={rememberMe}
            onValueChange={setRememberMe}
            trackColor={{ false: theme.colors.surface3, true: theme.colors.accentSoft }}
            thumbColor={rememberMe ? theme.colors.accent : theme.colors.ink4}
          />
          <Text style={styles.rememberLabel}>Remember me</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Go back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: theme.colors.bg },
  title: { fontSize: 32, fontFamily: theme.fonts.serif, color: theme.colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    borderRadius: theme.radii.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    letterSpacing: 0,
    marginBottom: 12,
    color: theme.colors.ink,
    backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.sans,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rememberWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberLabel: { fontSize: 13, color: theme.colors.ink2, fontFamily: theme.fonts.sans },
  forgot: { fontSize: 13, color: theme.colors.accentSoft, fontFamily: theme.fonts.sans },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    padding: 16,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  buttonDisabled: { backgroundColor: theme.colors.accentSoft, shadowOpacity: 0 },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center' },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
