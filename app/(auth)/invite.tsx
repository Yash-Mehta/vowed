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
  ImageBackground,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { validateInviteCode, CodeIndexDoc } from '../../lib/firestore';
import { SprigDivider } from '../../components/SprigDivider';
import { theme } from '../../constants/theme';

const HERO_URL =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80';

export default function InviteScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CodeIndexDoc['preview'] | null>(null);
  const router = useRouter();
  const { setPendingRole, setPendingWeddingId } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    const result = await validateInviteCode(code.trim().toUpperCase());
    setLoading(false);
    if (result) {
      setPendingRole(result.role);
      setPendingWeddingId(result.weddingId);
      setPreview(result.preview);
      router.push({
        pathname: '/(auth)/register',
        params: { code: code.trim().toUpperCase(), role: result.role, weddingId: result.weddingId },
      });
    } else {
      Alert.alert('Invalid code', 'Please check the code and try again.');
    }
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

        <View style={styles.hero}>
          <ImageBackground source={{ uri: HERO_URL }} style={styles.heroImage} resizeMode="cover">
            <LinearGradient
              colors={['rgba(42,29,23,0.10)', 'rgba(250,246,241,0)', 'rgba(250,246,241,1)']}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        </View>

        <Animated.View style={[styles.badge, { opacity: fadeAnim }]}>
          <Text style={styles.badgeText}>You're invited</Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={{ marginBottom: 14, marginTop: 200 }}>
            <View style={styles.logoCircle}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="cover" />
            </View>
          </View>

          <Text style={styles.eyebrow}>Together with their families</Text>

          {preview ? (
            <>
              <Text style={styles.nameDisplay}>{preview.coupleName.split(' & ')[0] ?? preview.coupleName}</Text>
              <Text style={styles.and}>and</Text>
              <Text style={styles.nameDisplay}>{preview.coupleName.split(' & ')[1] ?? ''}</Text>
            </>
          ) : (
            <>
              <Text style={styles.nameDisplay}>—</Text>
              <Text style={styles.and}>and</Text>
              <Text style={styles.nameDisplay}>—</Text>
            </>
          )}

          <View style={styles.dividerWrap}>
            <SprigDivider color={theme.colors.accent} />
          </View>

          {preview && (
            <>
              <Text style={styles.dateStamp}>{preview.dateStamp}</Text>
              <Text style={styles.venue}>{preview.venue}</Text>
            </>
          )}

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="INVITE CODE"
            placeholderTextColor={theme.colors.ink4}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="join"
            onSubmitEditing={handleJoin}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleJoin}
            disabled={loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color={theme.colors.bg} />
              : <Text style={styles.buttonText}>Open the album</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInText}>Already have an account? <Text style={styles.signInBold}>Sign in</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createLink} onPress={() => router.push('/(onboarding)/create-account')}>
            <Text style={styles.createText}>Planning a wedding? <Text style={styles.createBold}>Create yours</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flexGrow: 1 },
  hero: { height: 340, overflow: 'hidden' },
  heroImage: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 200,
    alignSelf: 'center',
    backgroundColor: 'rgba(250,246,241,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: theme.radii.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(122,74,63,0.2)',
    zIndex: 4,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  card: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: 'center',
    marginTop: -50,
  },
  logoCircle: { width: 150, height: 150, borderRadius: 75, overflow: 'hidden' },
  logoImage: { width: 150, height: 150 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    marginBottom: 6,
  },
  nameDisplay: {
    fontSize: 54,
    fontFamily: theme.fonts.serif,
    fontWeight: '500',
    color: theme.colors.ink,
    lineHeight: 58,
  },
  and: {
    fontSize: 24,
    fontFamily: theme.fonts.serifItalic,
    fontStyle: 'italic',
    color: theme.colors.accent,
    marginVertical: 2,
  },
  dividerWrap: { width: '60%', marginVertical: 14 },
  dateStamp: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: theme.colors.ink2,
    marginBottom: 6,
  },
  venue: {
    fontSize: 11,
    fontStyle: 'italic',
    color: theme.colors.ink3,
    marginBottom: 24,
    fontFamily: theme.fonts.serifItalic,
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
    paddingVertical: 13,
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
});
