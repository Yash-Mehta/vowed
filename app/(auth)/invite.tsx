import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { validateInviteCode, getMember, CodeIndexDoc } from '../../lib/firestore';
import { SprigDivider } from '../../components/SprigDivider';
import { theme } from '../../constants/theme';
import { auth } from '../../lib/firebase';

export default function InviteScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CodeIndexDoc['preview'] | null>(null);
  const [pendingResult, setPendingResult] = useState<{ weddingId: string; role: 'guest' | 'host' } | null>(null);
  const router = useRouter();
  const { setPendingRole, setPendingWeddingId } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const previewAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    const result = await validateInviteCode(code.trim().toUpperCase());
    if (!result) {
      setLoading(false);
      Alert.alert('Invalid code', 'Please check the code and try again.');
      return;
    }
    if (auth.currentUser) {
      try {
        const existing = await getMember(result.weddingId, auth.currentUser.uid);
        if (existing) {
          setLoading(false);
          Alert.alert('Already joined', "You're already part of this wedding.");
          return;
        }
      } catch {
        // Permission denied means user is not a member — proceed normally
      }
    }
    setLoading(false);
    setPendingRole(result.role);
    setPendingWeddingId(result.weddingId);
    setPreview(result.preview);
    setPendingResult({ weddingId: result.weddingId, role: result.role });
    Animated.timing(previewAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function handleContinue() {
    if (!pendingResult) return;
    // Already authenticated — skip registration, go straight to profile setup
    if (auth.currentUser) {
      router.push('/(auth)/profile-setup');
      return;
    }
    router.push({
      pathname: '/(auth)/register',
      params: { code: code.trim().toUpperCase(), role: pendingResult.role, weddingId: pendingResult.weddingId },
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">

        {/* Gradient header */}
        <LinearGradient
          colors={[theme.colors.countdownStart, theme.colors.countdownEnd]}
          style={styles.hero}>
          <Animated.View style={[styles.heroContent, { opacity: fadeAnim }]}>
            <Text style={styles.appName}>Vowed</Text>
            <Text style={styles.appTagline}>Your wedding, beautifully shared</Text>
          </Animated.View>
        </LinearGradient>

        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

          {/* Default state — generic */}
          {!preview && (
            <>
              <Text style={styles.cardTitle}>You're invited</Text>
              <Text style={styles.cardSub}>Enter the invite code from your couple to join their wedding album.</Text>
              <View style={styles.dividerWrap}>
                <SprigDivider color={theme.colors.accent} />
              </View>
            </>
          )}

          {/* After code validates — show couple preview */}
          {preview && (
            <Animated.View style={{ opacity: previewAnim }}>
              <Text style={styles.eyebrow}>Together with their families</Text>
              <Text style={styles.nameDisplay}>{preview.coupleName.split(' & ')[0] ?? preview.coupleName}</Text>
              <Text style={styles.andText}>and</Text>
              <Text style={styles.nameDisplay}>{preview.coupleName.split(' & ')[1] ?? ''}</Text>
              <View style={styles.dividerWrap}>
                <SprigDivider color={theme.colors.accent} />
              </View>
              {preview.dateStamp && <Text style={styles.dateStamp}>{preview.dateStamp}</Text>}
              {preview.venue && <Text style={styles.venue}>{preview.venue}</Text>}
            </Animated.View>
          )}

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              if (preview) {
                setPreview(null);
                setPendingResult(null);
                previewAnim.setValue(0);
              }
            }}
            placeholder="INVITE CODE"
            placeholderTextColor={theme.colors.ink4}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={preview ? handleContinue : handleJoin}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />

          {!preview ? (
            <TouchableOpacity
              style={styles.button}
              onPress={handleJoin}
              disabled={loading}
              activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={theme.colors.bg} />
                : <Text style={styles.buttonText}>Open the album</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={handleContinue}
              activeOpacity={0.85}>
              <Text style={styles.buttonText}>Join this wedding</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.signInLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInText}>Already have an account? <Text style={styles.signInBold}>Sign in</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createLink} onPress={() => router.push('/(onboarding)/create-account')}>
            <Text style={styles.createText}>Planning a wedding? <Text style={styles.createBold}>Create yours</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => {
            setPendingWeddingId(null);
            setPreview(null);
            setPendingResult(null);
            previewAnim.setValue(0);
            router.back();
          }}>
            <Text style={styles.backText}>Go back</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flexGrow: 1 },
  hero: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  heroContent: { alignItems: 'center' },
  appName: {
    fontSize: 52,
    fontFamily: theme.fonts.serif,
    color: theme.colors.bg,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 13,
    color: 'rgba(250,246,241,0.75)',
    fontFamily: theme.fonts.sans,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  card: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 26,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    marginBottom: 10,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 14,
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    marginBottom: 10,
    textAlign: 'center',
  },
  nameDisplay: {
    fontSize: 48,
    fontFamily: theme.fonts.serif,
    fontWeight: '500',
    color: theme.colors.ink,
    lineHeight: 54,
    textAlign: 'center',
  },
  andText: {
    fontSize: 22,
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.accent,
    marginVertical: 4,
    textAlign: 'center',
  },
  dividerWrap: { width: '60%', marginVertical: 16, alignSelf: 'center' },
  dateStamp: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.ink2,
    marginBottom: 6,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
  },
  venue: {
    fontSize: 12,
    color: theme.colors.ink3,
    marginBottom: 20,
    fontFamily: theme.fonts.serifItalic,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.ink,
    backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.sans,
  },
  button: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  buttonText: { color: theme.colors.bg, fontSize: 15, fontWeight: '500', fontFamily: theme.fonts.sans },
  signInLink: { marginTop: 20, padding: 8 },
  signInText: { fontSize: 13, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  signInBold: { color: theme.colors.accent, fontWeight: '600' },
  createLink: { marginTop: 4, padding: 8 },
  createText: { fontSize: 13, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  createBold: { color: theme.colors.accentDeep, fontWeight: '600' },
  backLink: { marginTop: 4, padding: 8 },
  backText: { fontSize: 13, color: theme.colors.ink4, fontFamily: theme.fonts.sans },
});
