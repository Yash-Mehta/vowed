import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

export default function IndexScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.countdownStart, theme.colors.countdownEnd]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="cover" />
        </View>
        <Text style={styles.appName}>Our Day</Text>
        <Text style={styles.tagline}>Your wedding, beautifully shared</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/invite')}
          activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>I have an invite code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(onboarding)/create-account')}
          activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>Plan your wedding</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.7}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: 80, paddingHorizontal: 32 },
  logoWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  logoCircle: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 20 },
  logo: { width: 120, height: 120 },
  appName: {
    fontSize: 40,
    fontFamily: theme.fonts.serif,
    color: theme.colors.bg,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(250,246,241,0.7)',
    fontFamily: theme.fonts.sans,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(250,246,241,0.15)',
    borderRadius: theme.radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250,246,241,0.35)',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.bg,
    fontFamily: theme.fonts.sans,
  },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 13, color: 'rgba(250,246,241,0.65)', fontFamily: theme.fonts.sans },
  linkBold: { fontWeight: '700', color: theme.colors.bg },
});
