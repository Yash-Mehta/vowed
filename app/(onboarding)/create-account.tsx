import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { saveCredentials } from '../../lib/secureAuth';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { theme } from '../../constants/theme';

export default function CreateAccountScreen() {
  const router = useRouter();
  const { setPendingRole, userDoc } = useAuthStore();
  const { update } = useOnboardingStore();

  const alreadySignedIn = !!auth.currentUser;

  const [ownerName, setOwnerName] = useState(
    alreadySignedIn ? (userDoc?.displayName ?? '') : ''
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in — just collect their name and proceed
  function handleContinueSignedIn() {
    if (!ownerName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    setPendingRole('host');
    update({ ownerName: ownerName.trim() });
    router.push('/(onboarding)/names');
  }

  // Not signed in — create or sign in to account first
  async function handleContinueNewAccount() {
    if (!ownerName.trim() || !email.trim() || !password) return;
    if (password.length < 6) {
      Alert.alert('Password too short', 'Minimum 6 characters.');
      return;
    }
    setLoading(true);
    try {
      setPendingRole('host');
      update({ ownerName: ownerName.trim() });
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
      } catch (e: any) {
        if (e.code === 'auth/email-already-in-use') {
          try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
          } catch (signInError: any) {
            const isWrongPassword =
              signInError.code === 'auth/wrong-password' ||
              signInError.code === 'auth/invalid-credential';
            throw new Error(
              isWrongPassword
                ? 'An account with this email exists. Please sign in with your correct password, or use "Forgot password".'
                : 'An account with this email already exists. Please sign in instead.'
            );
          }
        } else {
          throw e;
        }
      }
      await saveCredentials(email.trim(), password);
      router.replace('/(auth)/verify-email');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (alreadySignedIn) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.progress}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <Text style={styles.eyebrow}>Step 1 of 4</Text>
          <Text style={styles.title}>Plan your wedding</Text>
          <Text style={styles.sub}>
            You're already signed in. Just confirm your name and we'll set up your wedding.
          </Text>

          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Alex Chen"
            placeholderTextColor={theme.colors.ink4}
            autoCapitalize="words"
            autoFocus
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleContinueSignedIn}
            activeOpacity={0.85}>
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.eyebrow}>Step 1 of 4</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.sub}>
          You'll be the host. We'll set up your wedding details next.
        </Text>

        <Text style={styles.label}>YOUR NAME</Text>
        <TextInput
          style={styles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="e.g. Alex Chen"
          placeholderTextColor={theme.colors.ink4}
          autoCapitalize="words"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={theme.colors.ink4}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min 6 characters"
          placeholderTextColor={theme.colors.ink4}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleContinueNewAccount}
          disabled={loading}
          activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color={theme.colors.bg} />
            : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 32, paddingTop: 64, paddingBottom: 60 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: theme.colors.line },
  dotActive: { backgroundColor: theme.colors.accent },
  eyebrow: {
    fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase',
    color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 8,
  },
  title: {
    fontSize: 30, fontWeight: '700', color: theme.colors.ink,
    fontFamily: theme.fonts.serif, marginBottom: 10,
  },
  sub: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 28, lineHeight: 20 },
  label: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.ink4,
    fontFamily: theme.fonts.sans, marginBottom: 6, marginTop: 14, textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: theme.radii.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
    letterSpacing: 0,
  },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnDisabled: { backgroundColor: theme.colors.accentSoft },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
