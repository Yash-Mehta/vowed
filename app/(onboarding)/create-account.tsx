import { useState, useEffect, useRef } from 'react';
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
import { auth } from '../../lib/firebase';
import { getUserIndex } from '../../lib/firestore';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useKeyboardAwareScroll } from '../../hooks/useKeyboardAwareScroll';
import { sendPhoneOtp, verifyPhoneOtp, buildE164, OtpRateLimitedError, OtpInvalidCodeError } from '../../lib/phoneAuth';
import { CountryCodePicker } from '../../components/CountryCodePicker';
import { OtpCodeInput } from '../../components/OtpCodeInput';
import { DEFAULT_COUNTRY, Country } from '../../constants/countries';
import { theme } from '../../constants/theme';

const RESEND_COOLDOWN_START_S = 30;

export default function CreateAccountScreen() {
  const router = useRouter();
  const { setPendingRole, globalProfile } = useAuthStore();
  const { update } = useOnboardingStore();
  const { scrollViewRef, scrollToInput } = useKeyboardAwareScroll();

  const alreadySignedIn = !!auth.currentUser;
  // Global profile is populated by _layout.tsx's auth-state listener, so
  // it's already available here whenever the user is mid-session.
  const hasGlobalProfile = alreadySignedIn && !!globalProfile?.displayName;

  const [ownerName, setOwnerName] = useState(
    alreadySignedIn ? (globalProfile?.displayName ?? '') : ''
  );
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneInput, setPhoneInput] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const nextCooldownRef = useRef(RESEND_COOLDOWN_START_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  // Not signed in — send a code to their phone
  async function handleSendCode() {
    if (!ownerName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    const normalized = buildE164(country.dialCode, phoneInput);
    if (!normalized) {
      Alert.alert('Invalid number', 'Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(normalized);
      setE164Phone(normalized);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_START_S);
      nextCooldownRef.current = RESEND_COOLDOWN_START_S * 2;
    } catch (e: unknown) {
      if (e instanceof OtpRateLimitedError) {
        Alert.alert('Too many attempts', e.message);
      } else {
        Alert.alert('Error', 'Could not send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await sendPhoneOtp(e164Phone);
      setCooldown(nextCooldownRef.current);
      nextCooldownRef.current *= 2;
    } catch (e: unknown) {
      if (e instanceof OtpRateLimitedError) {
        Alert.alert('Too many attempts', e.message);
      } else {
        Alert.alert('Error', 'Could not resend code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Verifies the code and signs in — verifyPhoneOtp finds the existing
  // account for this number if there is one, or creates a new one. A
  // genuinely brand-new phone number should proceed into wedding-creation
  // onboarding, but a number that already has an account with wedding(s)
  // on it should NOT be forced through that form again — that account
  // already exists; the person just needs to land where they're already a
  // member. _layout.tsx's own redirect guard has no pendingWeddingId to
  // steer it here (unlike the guest invite flow), so in the new-user case
  // we still navigate explicitly rather than relying on it.
  async function handleVerifyCode() {
    if (!codeInput.trim() || loading) return;
    setLoading(true);
    try {
      const { uid } = await verifyPhoneOtp(e164Phone, codeInput.trim());
      const idx = await getUserIndex(uid);
      if (idx?.weddingIds && idx.weddingIds.length > 0) {
        // Existing account, already has wedding(s) — let _layout.tsx's own
        // auth-state listener route them to /select-wedding once it catches
        // up, same as any other returning sign-in.
      } else {
        setPendingRole('host');
        update({ ownerName: ownerName.trim() });
        router.replace('/(onboarding)/names');
      }
      // Stay in the loading state on success — see phone.tsx's handleVerify
      // for why resetting it here can let a stale button tap burn an
      // already-consumed code during the navigation transition.
      setTimeout(() => setLoading(false), 8000);
    } catch (e: unknown) {
      if (e instanceof OtpInvalidCodeError) {
        Alert.alert('Incorrect code', e.message);
      } else if (e instanceof OtpRateLimitedError) {
        Alert.alert('Too many attempts', e.message);
      } else {
        Alert.alert('Error', 'Could not verify code. Please try again.');
      }
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
          {step === 'details'
            ? "You'll be the host. We'll set up your wedding details next."
            : `We sent a code to ${e164Phone}`}
        </Text>

        {step === 'details' ? (
          <>
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

            <Text style={styles.label}>PHONE NUMBER</Text>
            <View style={styles.phoneRow}>
              <CountryCodePicker value={country} onChange={setCountry} />
              <TextInput
                style={[styles.input, styles.phoneInput]}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.colors.ink4}
                keyboardType="phone-pad"
                onFocus={scrollToInput}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={theme.colors.bg} />
                : <Text style={styles.btnText}>Continue</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.back} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>VERIFICATION CODE</Text>
            <OtpCodeInput value={codeInput} onChangeText={setCodeInput} autoFocus />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
              activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={theme.colors.bg} />
                : <Text style={styles.btnText}>Verify</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.back} onPress={handleResendCode} disabled={cooldown > 0 || loading}>
              <Text style={[styles.backText, cooldown > 0 && styles.backTextDisabled]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.back} onPress={() => setStep('details')}>
              <Text style={styles.backText}>Use a different number</Text>
            </TouchableOpacity>
          </>
        )}
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
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start' },
  phoneInput: { flex: 1 },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnDisabled: { backgroundColor: theme.colors.accentSoft },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
  backTextDisabled: { color: theme.colors.ink4 },
});
