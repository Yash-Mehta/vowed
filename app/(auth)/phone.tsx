import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { sendPhoneOtp, verifyPhoneOtp, buildE164, OtpRateLimitedError, OtpInvalidCodeError } from '../../lib/phoneAuth';
import { CountryCodePicker } from '../../components/CountryCodePicker';
import { OtpCodeInput } from '../../components/OtpCodeInput';
import { DEFAULT_COUNTRY, Country } from '../../constants/countries';
import { theme } from '../../constants/theme';

const RESEND_COOLDOWN_START_S = 30;

export default function PhoneAuthScreen() {
  const params = useLocalSearchParams<{ code: string; role: string; weddingId: string }>();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role: 'guest' | 'host' = rawRole === 'host' ? 'host' : 'guest';
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] : params.weddingId;

  const { setPendingRole, setPendingWeddingId } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneInput, setPhoneInput] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const nextCooldownRef = useRef(RESEND_COOLDOWN_START_S);
  const router = useRouter();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSend() {
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

  async function handleResend() {
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

  async function handleVerify() {
    if (!codeInput.trim() || loading) return;
    setLoading(true);
    try {
      // Ensure store has the pending values (in case they navigated back).
      // Both writes are guarded on the param actually being supplied: this
      // screen is also reached from invite.tsx's plain "Sign in" link, which
      // passes no params. Writing an unguarded default there would clobber a
      // host code the user had just validated, silently joining them to that
      // wedding as a guest.
      if (rawRole) setPendingRole(role);
      if (weddingId) setPendingWeddingId(weddingId);
      await verifyPhoneOtp(e164Phone, codeInput.trim());
      // Success — stay in the loading state rather than resetting it.
      // _layout.tsx's own auth-state listener still has to finish a
      // Firestore read (getUserIndex) before it navigates away, so there's
      // a real window here where the code was already consumed; letting
      // the button become tappable again in that window is what causes a
      // confusing "invalid code" on a legitimately-correct code.
      // Safety net: if _layout.tsx's redirect hasn't fired within a few
      // seconds (e.g. a slow/stalled Firestore read), don't leave the
      // screen stuck forever with no way out.
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

  if (step === 'code') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>We sent a code to {e164Phone}</Text>
          <OtpCodeInput value={codeInput} onChangeText={setCodeInput} autoFocus />
          <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.back} onPress={handleResend} disabled={cooldown > 0 || loading}>
            <Text style={[styles.backText, cooldown > 0 && styles.backTextDisabled]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.back} onPress={() => setStep('phone')}>
            <Text style={styles.backText}>Use a different number</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter your phone number</Text>
        <Text style={styles.subtitle}>We'll text you a code to sign in</Text>
        <View style={styles.phoneRow}>
          <CountryCodePicker value={country} onChange={setCountry} />
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.colors.ink4}
            keyboardType="phone-pad"
            autoFocus
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Continue'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  // A ScrollView with top-anchored content, not a centered View — matches
  // invite.tsx's proven pattern (its own contentContainerStyle is plain
  // { flexGrow: 1 }, no justifyContent: 'center'). Centering re-centers
  // (visibly jumps) when the keyboard opens, since both screens autoFocus
  // immediately on mount; top-anchoring avoids the jump, and scrolling
  // (rather than a fixed offset) keeps content from ever being clipped
  // behind the keyboard on shorter devices.
  container: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 100, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, color: theme.colors.ink, fontFamily: theme.fonts.serif },
  subtitle: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: theme.radii.md,
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, marginBottom: 12,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  phoneInput: { flex: 1, marginBottom: 0 },
  button: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center' },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
  backTextDisabled: { color: theme.colors.ink4 },
});
