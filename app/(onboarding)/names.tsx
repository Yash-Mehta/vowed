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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../store/onboardingStore';
import { theme } from '../../constants/theme';

export default function NamesScreen() {
  const router = useRouter();
  const { draft, update } = useOnboardingStore();
  const [person1, setPerson1] = useState(draft.person1First);
  const [person2, setPerson2] = useState(draft.person2First);

  function handleContinue() {
    if (!person1.trim() || !person2.trim()) {
      Alert.alert('Required', 'Please enter both names.');
      return;
    }
    const p1 = person1.trim();
    const p2 = person2.trim();
    const coupleName = `${p1} & ${p2}`;
    const coupleNameFull = `${p1} & ${p2}`;
    const monogramInitials = `${p1[0]}${p2[0]}`;
    update({ person1First: p1, person2First: p2, coupleName, coupleNameFull, monogramInitials });
    router.push('/(onboarding)/date-venue');
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
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.eyebrow}>Step 2 of 5</Text>
        <Text style={styles.title}>The happy couple</Text>
        <Text style={styles.sub}>Enter the first names of the two people getting married.</Text>

        <Text style={styles.label}>PARTNER 1</Text>
        <TextInput
          style={styles.input}
          value={person1}
          onChangeText={setPerson1}
          placeholder="e.g. Yash"
          placeholderTextColor={theme.colors.ink4}
          autoCapitalize="words"
          autoFocus
        />

        <Text style={styles.and}>and</Text>

        <Text style={styles.label}>PARTNER 2</Text>
        <TextInput
          style={styles.input}
          value={person2}
          onChangeText={setPerson2}
          placeholder="e.g. Vaani"
          placeholderTextColor={theme.colors.ink4}
          autoCapitalize="words"
        />

        {person1 && person2 && (
          <View style={styles.preview}>
            <Text style={styles.previewName}>{person1.trim()}</Text>
            <Text style={styles.previewAnd}>and</Text>
            <Text style={styles.previewName}>{person2.trim()}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.btnText}>Continue</Text>
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
  label: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.ink4,
    fontFamily: theme.fonts.sans, marginBottom: 6, textTransform: 'uppercase',
  },
  and: {
    fontSize: 16, fontStyle: 'italic', color: theme.colors.accent,
    fontFamily: theme.fonts.serifItalic, textAlign: 'center', marginVertical: 10,
  },
  input: {
    borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: theme.radii.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
  },
  preview: {
    marginTop: 28, padding: 20, backgroundColor: theme.colors.surface2,
    borderRadius: theme.radii.lg, alignItems: 'center',
    borderWidth: 0.5, borderColor: theme.colors.line,
  },
  previewName: { fontSize: 36, fontFamily: theme.fonts.serif, color: theme.colors.ink },
  previewAnd: {
    fontSize: 18, fontStyle: 'italic', color: theme.colors.accent,
    fontFamily: theme.fonts.serifItalic, marginVertical: 4,
  },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
