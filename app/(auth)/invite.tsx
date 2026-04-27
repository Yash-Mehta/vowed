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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { validateInviteCode } from '../../lib/firestore';
import { MonogramLarge } from '../../components/MonogramLarge';
import { SprigDivider } from '../../components/SprigDivider';
import { theme } from '../../constants/theme';
import { WEDDING, getDaysUntilWedding } from '../../constants/WEDDING';

const HERO_URL =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80';

export default function InviteScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    const valid = await validateInviteCode(code.trim().toUpperCase());
    setLoading(false);
    if (valid) {
      router.push({ pathname: '/(auth)/register', params: { code: code.trim().toUpperCase() } });
    } else {
      Alert.alert('Invalid code', 'Please check the code and try again.');
    }
  }

  const daysAway = getDaysUntilWedding();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {/* Hero image */}
      <View style={styles.hero}>
        <ImageBackground source={{ uri: HERO_URL }} style={styles.heroImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(42,29,23,0.10)', 'rgba(250,246,241,0)', 'rgba(250,246,241,1)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </View>

      {/* Invited pill badge */}
      <Animated.View style={[styles.badge, { opacity: fadeAnim }]}>
        <Text style={styles.badgeText}>You're invited</Text>
      </Animated.View>

      {/* Invitation card */}
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], marginBottom: 14 }}>
          <MonogramLarge size={150} color={theme.colors.accent} />
        </Animated.View>

        <Text style={styles.eyebrow}>Together with their families</Text>

        <Text style={styles.nameDisplay}>Yash</Text>
        <Text style={styles.and}>and</Text>
        <Text style={styles.nameDisplay}>Vaani</Text>

        <View style={styles.dividerWrap}>
          <SprigDivider color={theme.colors.accent} />
        </View>

        <Text style={styles.dateStamp}>{WEDDING.dateStamp}</Text>
        <Text style={styles.venue}>{WEDDING.venue}</Text>

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
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleJoin}
          disabled={loading}
          activeOpacity={0.85}>
          <Text style={styles.buttonText}>{loading ? 'Checking…' : 'Open the album'}</Text>
        </TouchableOpacity>

        <Text style={styles.countdown}>{daysAway} days · till the big day</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flexGrow: 1 },
  hero: { height: 340, overflow: 'hidden' },
  heroImage: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 290,
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
  buttonText: {
    color: theme.colors.bg,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: theme.fonts.sans,
  },
  countdown: {
    fontSize: 11,
    color: theme.colors.ink3,
    marginTop: 12,
    fontFamily: theme.fonts.sans,
  },
});
