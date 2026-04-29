import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../store/onboardingStore';
import { theme } from '../../constants/theme';

function generateCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix;
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function InviteCodesScreen() {
  const router = useRouter();
  const { draft, update } = useOnboardingStore();
  const [guestCode, setGuestCode] = useState(
    draft.guestInviteCode || generateCode('G-')
  );
  const [hostCode, setHostCode] = useState(
    draft.hostInviteCode || generateCode('H-')
  );

  function handleContinue() {
    const g = guestCode.trim().toUpperCase().replace(/\s/g, '');
    const h = hostCode.trim().toUpperCase().replace(/\s/g, '');
    if (!g || !h) {
      Alert.alert('Required', 'Both invite codes are required.');
      return;
    }
    if (g === h) {
      Alert.alert('Codes must differ', 'Guest and host codes cannot be the same.');
      return;
    }
    if (g.length < 4 || h.length < 4) {
      Alert.alert('Too short', 'Codes must be at least 4 characters.');
      return;
    }
    update({ guestInviteCode: g, hostInviteCode: h });
    router.push('/(onboarding)/confirm');
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <Text style={styles.eyebrow}>Step 5 of 5</Text>
      <Text style={styles.title}>Invite codes</Text>
      <Text style={styles.sub}>
        Share the guest code with your attendees. Use the host code to add other hosts.
      </Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>GUEST CODE</Text>
        <Text style={styles.codeHint}>Share this with all attendees</Text>
        <TextInput
          style={styles.codeInput}
          value={guestCode}
          onChangeText={(t) => setGuestCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        <TouchableOpacity
          style={styles.regenerate}
          onPress={() => setGuestCode(generateCode('G-'))}
          activeOpacity={0.7}>
          <Text style={styles.regenerateText}>Regenerate</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.codeCard, { marginTop: 16 }]}>
        <Text style={styles.codeLabel}>HOST CODE</Text>
        <Text style={styles.codeHint}>Share with co-hosts only — gives admin access</Text>
        <TextInput
          style={[styles.codeInput, { borderColor: theme.colors.accentDeep }]}
          value={hostCode}
          onChangeText={(t) => setHostCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        <TouchableOpacity
          style={styles.regenerate}
          onPress={() => setHostCode(generateCode('H-'))}
          activeOpacity={0.7}>
          <Text style={styles.regenerateText}>Regenerate</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
        <Text style={styles.btnText}>Review & launch</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 32, paddingTop: 64, paddingBottom: 60 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: theme.colors.line },
  dotActive: { backgroundColor: theme.colors.accent },
  dotDone: { backgroundColor: theme.colors.accentSoft },
  eyebrow: {
    fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase',
    color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 8,
  },
  title: {
    fontSize: 30, fontWeight: '700', color: theme.colors.ink,
    fontFamily: theme.fonts.serif, marginBottom: 10,
  },
  sub: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 28, lineHeight: 20 },
  codeCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radii.lg,
    padding: 20, borderWidth: 0.5, borderColor: theme.colors.line, ...theme.shadows.s1,
  },
  codeLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
    color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 4,
  },
  codeHint: { fontSize: 12, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 12 },
  codeInput: {
    borderWidth: 1.5, borderColor: theme.colors.accent, borderRadius: theme.radii.md,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 22,
    color: theme.colors.ink, fontFamily: theme.fonts.sans,
    letterSpacing: 4, textAlign: 'center',
  },
  regenerate: { marginTop: 10, alignSelf: 'flex-end' },
  regenerateText: { fontSize: 12, color: theme.colors.accent, fontFamily: theme.fonts.sans },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
