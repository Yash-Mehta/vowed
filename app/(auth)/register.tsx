import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { saveCredentials } from '../../lib/secureAuth';
import { theme } from '../../constants/theme';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ code: string; role: string }>();
  const role: 'guest' | 'host' = (Array.isArray(params.role) ? params.role[0] : params.role) === 'host' ? 'host' : 'guest';
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await saveCredentials(email, password);
      router.replace({ pathname: '/(auth)/profile-setup', params: { role: role ?? 'guest' } });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Create your account</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.colors.ink4}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min 6 chars)"
        placeholderTextColor={theme.colors.ink4}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Continue'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Go back</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.back} onPress={() => router.replace('/(auth)/login')}>
        <Text style={[styles.backText, { color: theme.colors.accent }]}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: theme.colors.bg },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
  },
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
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center' },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
