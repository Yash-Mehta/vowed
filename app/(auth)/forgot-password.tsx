import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { theme } from '../../constants/theme';
import { SprigDivider } from '../../components/SprigDivider';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSend() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      const code: string = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('No account found with that email address.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('No internet connection. Please check your network.');
      } else {
        setError(e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sentWrap}>
          <Text style={styles.sentIcon}>✦</Text>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.sentBody}>
            We sent a password reset link to{'\n'}
            <Text style={styles.sentEmail}>{email.trim().toLowerCase()}</Text>
          </Text>

          <View style={styles.dividerWrap}>
            <SprigDivider />
          </View>

          <Text style={styles.hint}>
            Click the link in the email to choose a new password, then come back and sign in.{'\n\n'}
            Can't find it? Check your <Text style={{ fontWeight: '700' }}>spam or junk folder</Text> — Firebase emails sometimes land there.
          </Text>

          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resend} onPress={() => setSent(false)}>
            <Text style={styles.resendText}>Resend email</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backLabel}>Sign in</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        value={email}
        onChangeText={t => { setEmail(t); setError(''); }}
        placeholder="Email address"
        placeholderTextColor={theme.colors.ink4}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={!email.trim() || loading}
        activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, backgroundColor: theme.colors.bg, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 40, alignSelf: 'flex-start' },
  backArrow: { fontSize: 20, color: theme.colors.ink3 },
  backLabel: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  title: { fontSize: 30, fontFamily: theme.fonts.serif, color: theme.colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 28, lineHeight: 20 },
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
  inputError: { borderColor: theme.colors.heart },
  errorText: { fontSize: 13, color: theme.colors.heart, marginBottom: 12, fontFamily: theme.fonts.sans },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  buttonDisabled: { backgroundColor: theme.colors.surface3, shadowOpacity: 0 },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  // Sent state
  sentWrap: { alignItems: 'center' },
  sentIcon: { fontSize: 48, marginBottom: 16 },
  sentBody: { fontSize: 15, color: theme.colors.ink2, textAlign: 'center', lineHeight: 22, fontFamily: theme.fonts.sans, marginBottom: 20 },
  sentEmail: { fontWeight: '600', color: theme.colors.accent },
  dividerWrap: { width: '60%', marginVertical: 20 },
  hint: { fontSize: 13, color: theme.colors.ink3, textAlign: 'center', lineHeight: 20, fontFamily: theme.fonts.sans, marginBottom: 28 },
  resend: { marginTop: 12, padding: 8 },
  resendText: { fontSize: 13, color: theme.colors.accentSoft, fontFamily: theme.fonts.sans },
});
