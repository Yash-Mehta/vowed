import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../store/onboardingStore';
import { WEDDING_PALETTES } from '../../utils/colorUtils';
import { theme } from '../../constants/theme';

export default function ThemeScreen() {
  const router = useRouter();
  const { draft, update } = useOnboardingStore();

  function selectPalette(p: typeof WEDDING_PALETTES[0]) {
    update({
      accentHex: p.accent,
      accentDeepHex: p.deep,
      accentSoftHex: p.soft,
      accentTintHex: p.tint,
    });
  }

  const selected = WEDDING_PALETTES.find((p) => p.accent === draft.accentHex);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotDone]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>

      <Text style={styles.eyebrow}>Step 4 of 5</Text>
      <Text style={styles.title}>Choose your palette</Text>
      <Text style={styles.sub}>Pick a colour theme that reflects your wedding style.</Text>

      <View style={styles.grid}>
        {WEDDING_PALETTES.map((p) => {
          const isSelected = draft.accentHex === p.accent;
          return (
            <TouchableOpacity
              key={p.name}
              style={[
                styles.paletteCard,
                isSelected && { borderColor: p.deep, borderWidth: 2 },
              ]}
              onPress={() => selectPalette(p)}
              activeOpacity={0.8}>
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: p.tint }]} />
                <View style={[styles.swatch, { backgroundColor: p.soft }]} />
                <View style={[styles.swatch, { backgroundColor: p.accent }]} />
                <View style={[styles.swatch, { backgroundColor: p.deep }]} />
              </View>
              <Text style={[styles.paletteName, isSelected && { color: p.deep }]}>{p.name}</Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: p.accent }]}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && (
        <View style={[styles.preview, { backgroundColor: selected.tint, borderColor: selected.soft }]}>
          <Text style={[styles.previewText, { color: selected.deep }]}>
            {draft.person1First} & {draft.person2First}
          </Text>
          <Text style={[styles.previewSub, { color: selected.accent }]}>{selected.name} theme selected</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: draft.accentHex }]}
        onPress={() => router.push('/(onboarding)/invite-codes')}
        activeOpacity={0.85}>
        <Text style={styles.btnText}>Continue</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  paletteCard: {
    width: '47%', backgroundColor: theme.colors.card, borderRadius: theme.radii.lg,
    padding: 14, borderWidth: 1, borderColor: theme.colors.line, position: 'relative',
    ...theme.shadows.s1,
  },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  swatch: { flex: 1, height: 24, borderRadius: 4 },
  paletteName: { fontSize: 13, fontWeight: '600', color: theme.colors.ink2, fontFamily: theme.fonts.sans },
  checkBadge: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  checkText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  preview: {
    padding: 20, borderRadius: theme.radii.lg, alignItems: 'center',
    marginBottom: 20, borderWidth: 1,
  },
  previewText: { fontSize: 26, fontFamily: theme.fonts.serif, marginBottom: 4 },
  previewSub: { fontSize: 12, fontFamily: theme.fonts.sans },
  btn: {
    borderRadius: theme.radii.pill, padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
