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
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useKeyboardAwareScroll } from '../../hooks/useKeyboardAwareScroll';
import { getUserIndex } from '../../lib/firestore';
import { theme } from '../../constants/theme';

export default function CreateAccountScreen() {
  const router = useRouter();
  const { setPendingRole, globalProfile, setGlobalProfile } = useAuthStore();
  const { update } = useOnboardingStore();
  const { scrollViewRef, scrollToInput } = useKeyboardAwareScroll();

  const alreadySignedIn = !!auth.currentUser;
  // Global profile is populated by _layout.tsx's auth-state listener, so
  // it's already available here whenever the user is mid-session.
  const hasGlobalProfile = alreadySignedIn && !!globalProfile?.displayName;

  const [ownerName, setOwnerName] = useState(
    alreadySignedIn ? (globalProfile?.displayName ?? '') : ''
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
      let isNewUser = false;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        isNewUser = true;
      } catch (e: any) {
        if (e.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            // We don't know until this resolves whether this account
            // already has a global profile — the store's globalProfile
            // isn't populated yet (that happens async via _layout.tsx's
            // own auth-state listener), so fetch it directly here and use
            // their real name instead of whatever they just typed.
            const idx = await getUserIndex(cred.user.uid);
            if (idx?.displayName) {
              update({ ownerName: idx.displayName });
              setGlobalProfile({ displayName: idx.displayName, photoURL: idx.photoURL ?? null });
            }
            Alert.alert('Welcome back', 'You already had an account with this email — we signed you in instead of creating a new one.');
          } catch (signInError: any) {
            const isWrongPassword =
              signInError.code === 'auth/wrong-password' ||
              signInError.code === 'auth/invalid-credential';
            Alert.alert(
              'Account already exists',
              isWrongPassword
                ? 'An account with this email exists. Please sign in with your correct password, or use "Forgot password".'
                : 'An account with this email exists. Please sign in instead.',
              [
                { text: 'Sign in', onPress: () => router.replace('/(auth)/login') },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
            return;
          }
        } else {
          throw e;
        }
      }
      if (isNewUser) {
        router.replace('/(auth)/verify-email');
      } else {
        // Existing account, signed in via the fallback above — still needs
        // to continue into host onboarding. Unlike the guest invite flow,
        // there's no pendingWeddingId here to steer _layout.tsx's generic
        // guard, so an existing multi-wedding user would otherwise get
        // routed to /select-wedding instead of where they were headed.
        router.replace('/(onboarding)/names');
      }
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollViewRef}
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
            {hasGlobalProfile
              ? "You're already signed in — we'll set up your wedding under your existing profile."
              : "You're already signed in. Just confirm your name and we'll set up your wedding."}
          </Text>

          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={[styles.input, hasGlobalProfile && styles.inputReadOnly]}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Alex Chen"
            placeholderTextColor={theme.colors.ink4}
            autoCapitalize="words"
            autoFocus={!hasGlobalProfile}
            editable={!hasGlobalProfile}
            onFocus={scrollToInput}
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          onFocus={scrollToInput}
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
          onFocus={scrollToInput}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min 6 characters"
          placeholderTextColor={theme.colors.ink4}
          secureTextEntry
          onFocus={scrollToInput}
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

        <TouchableOpacity style={styles.back} onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.backText, { color: theme.colors.accent }]}>Already have an account? Sign in</Text>
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
  inputReadOnly: { backgroundColor: theme.colors.surface2, color: theme.colors.ink3 },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnDisabled: { backgroundColor: theme.colors.accentSoft },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
