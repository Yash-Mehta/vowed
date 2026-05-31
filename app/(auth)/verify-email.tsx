import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { sendEmailVerification, reload, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { clearCredentials } from '../../lib/secureAuth';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../constants/theme';

export default function VerifyEmailScreen() {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const { pendingRole, pendingWeddingId } = useAuthStore();

  async function handleCheckVerified() {
    const user = auth.currentUser;
    if (!user) return;
    setChecking(true);
    try {
      await reload(user);
      if (user.emailVerified) {
        if (pendingRole === 'host' && !pendingWeddingId) {
          // Creating a new wedding (no existing wedding to join)
          router.replace('/(onboarding)/names');
        } else {
          router.replace('/(auth)/profile-setup');
        }
      } else {
        Alert.alert(
          'Not verified yet',
          'We haven\'t received your verification. Check your inbox and click the link, then try again.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    const user = auth.currentUser;
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert('Email sent', 'Check your inbox for a new verification link.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setResending(false);
    }
  }

  async function handleCancel() {
    await signOut(auth);
    await clearCredentials();
    router.replace('/');
  }

  const email = auth.currentUser?.email ?? 'your email';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.title}>Check your inbox</Text>
      <Text style={styles.body}>
        We sent a verification link to{' '}
        <Text style={styles.email}>{email}</Text>. Open it to confirm your address, then come back here.
      </Text>
      <Text style={styles.spamNote}>
        Can't find it? Check your <Text style={{ fontWeight: '700' }}>spam or junk folder</Text> — verification emails sometimes land there.
      </Text>

      <TouchableOpacity
        style={[styles.button, checking && styles.buttonDisabled]}
        onPress={handleCheckVerified}
        disabled={checking}
        activeOpacity={0.85}>
        {checking
          ? <ActivityIndicator color={theme.colors.bg} size="small" />
          : <Text style={styles.buttonText}>I've verified my email</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.outlineButton, resending && styles.buttonDisabled]}
        onPress={handleResend}
        disabled={resending}
        activeOpacity={0.85}>
        {resending
          ? <ActivityIndicator color={theme.colors.accent} size="small" />
          : <Text style={styles.outlineButtonText}>Resend email</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.back} onPress={handleCancel}>
        <Text style={styles.backText}>Use a different email</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: theme.colors.bg },
  title: { fontSize: 28, fontFamily: theme.fonts.serif, color: theme.colors.ink, marginBottom: 16 },
  body: { fontSize: 15, fontFamily: theme.fonts.sans, color: theme.colors.ink2, lineHeight: 22, marginBottom: 12 },
  spamNote: { fontSize: 13, fontFamily: theme.fonts.sans, color: theme.colors.ink3, lineHeight: 19, marginBottom: 28 },
  email: { fontWeight: '600', color: theme.colors.ink },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  outlineButtonText: { color: theme.colors.accent, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center' },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
