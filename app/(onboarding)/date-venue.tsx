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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDateStamp(iso: string): { dateStamp: string; shortDate: string; displayDate: string } {
  try {
    const d = new Date(iso + 'T12:00:00Z');
    const month = d.toLocaleString('en-US', { month: 'long' });
    const day = d.getDate();
    const year = d.getFullYear();
    const monthShort = d.toLocaleString('en-US', { month: 'short' });
    const weekday = d.toLocaleString('en-US', { weekday: 'short' });
    return {
      dateStamp: `${weekday} · ${month} ${day}, ${year}`,
      shortDate: `${monthShort} ${day}, ${year}`,
      displayDate: `${month} ${day}, ${year}`,
    };
  } catch {
    return { dateStamp: '', shortDate: '', displayDate: '' };
  }
}

export default function DateVenueScreen() {
  const router = useRouter();
  const { draft, update } = useOnboardingStore();

  // Parse existing date if available
  const existingDate = draft.weddingDateISO ? new Date(draft.weddingDateISO + 'T12:00:00Z') : null;
  const [month, setMonth] = useState(existingDate ? existingDate.getMonth() : -1);
  const [day, setDay] = useState(existingDate ? String(existingDate.getDate()) : '');
  const [year, setYear] = useState(existingDate ? String(existingDate.getFullYear()) : '');
  const [ceremonyTime, setCeremonyTime] = useState(draft.weddingTimeLocal);
  const [firstDay, setFirstDay] = useState(draft.firstEventDateISO ? String(new Date(draft.firstEventDateISO + 'T12:00:00Z').getDate()) : '');
  const [venue, setVenue] = useState(draft.venue);
  const [venueShort, setVenueShort] = useState(draft.venueShort);
  const [location, setLocation] = useState(draft.location);
  const [registryUrl, setRegistryUrl] = useState(draft.registryUrl);

  function handleContinue() {
    if (month < 0 || !day.trim() || !year.trim() || !venue.trim() || !location.trim()) {
      Alert.alert('Required', 'Please fill in the wedding date, venue, and location.');
      return;
    }
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(y) || d < 1 || d > 31 || y < 2020 || y > 2099) {
      Alert.alert('Invalid date', 'Please enter a valid day and year.');
      return;
    }
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const weddingDateISO = `${y}-${mm}-${dd}`;

    let firstEventDateISO = weddingDateISO;
    if (firstDay.trim()) {
      const fd = parseInt(firstDay, 10);
      if (!isNaN(fd) && fd >= 1 && fd <= 31) {
        firstEventDateISO = `${y}-${mm}-${String(fd).padStart(2, '0')}`;
      }
    }

    const { dateStamp, shortDate, displayDate } = formatDateStamp(weddingDateISO);
    update({
      weddingDateISO,
      weddingTimeLocal: ceremonyTime.trim(),
      firstEventDateISO,
      dateStamp,
      shortDate,
      displayDate,
      venue: venue.trim(),
      venueShort: venueShort.trim() || venue.trim(),
      location: location.trim(),
      registryUrl: registryUrl.trim(),
    });
    router.push('/(onboarding)/invite-codes');
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
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.eyebrow}>Step 3 of 4</Text>
        <Text style={styles.title}>When and where</Text>
        <Text style={styles.sub}>Your wedding date and venue details.</Text>

        <Text style={styles.sectionHead}>WEDDING DATE</Text>
        <Text style={styles.label}>MONTH</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthRow}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[styles.monthChip, month === i && styles.monthChipActive]}
              onPress={() => setMonth(i)}
              activeOpacity={0.7}>
              <Text style={[styles.monthText, month === i && styles.monthTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>DAY</Text>
            <TextInput
              style={styles.input}
              value={day}
              onChangeText={setDay}
              placeholder="e.g. 5"
              placeholderTextColor={theme.colors.ink4}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>YEAR</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="e.g. 2026"
              placeholderTextColor={theme.colors.ink4}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        <Text style={styles.label}>CEREMONY TIME (optional)</Text>
        <TextInput
          style={styles.input}
          value={ceremonyTime}
          onChangeText={setCeremonyTime}
          placeholder="e.g. 15:00"
          placeholderTextColor={theme.colors.ink4}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />

        <Text style={styles.label}>FIRST EVENT DAY (optional)</Text>
        <TextInput
          style={styles.input}
          value={firstDay}
          onChangeText={setFirstDay}
          placeholder="Day of month for first event (e.g. 2)"
          placeholderTextColor={theme.colors.ink4}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={[styles.sectionHead, { marginTop: 20 }]}>VENUE</Text>
        <Text style={styles.label}>FULL VENUE NAME</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="e.g. The Grand Ballroom at Rosewood"
          placeholderTextColor={theme.colors.ink4}
        />

        <Text style={styles.label}>SHORT NAME (for display)</Text>
        <TextInput
          style={styles.input}
          value={venueShort}
          onChangeText={setVenueShort}
          placeholder="e.g. Rosewood Hotel"
          placeholderTextColor={theme.colors.ink4}
        />

        <Text style={styles.label}>CITY / COUNTRY</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Santorini, Greece"
          placeholderTextColor={theme.colors.ink4}
        />

        <Text style={styles.label}>REGISTRY URL (optional)</Text>
        <TextInput
          style={styles.input}
          value={registryUrl}
          onChangeText={setRegistryUrl}
          placeholder="https://your-registry.com"
          placeholderTextColor={theme.colors.ink4}
          autoCapitalize="none"
          keyboardType="url"
        />

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
  sub: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 24, lineHeight: 20 },
  sectionHead: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: theme.colors.accentDeep, fontFamily: theme.fonts.sans, marginBottom: 10,
    borderBottomWidth: 0.5, borderColor: theme.colors.line, paddingBottom: 6,
  },
  label: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.ink4,
    fontFamily: theme.fonts.sans, marginBottom: 6, marginTop: 12, textTransform: 'uppercase',
  },
  monthRow: { marginBottom: 4 },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface2, marginRight: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  monthChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accentDeep },
  monthText: { fontSize: 13, fontWeight: '600', color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  monthTextActive: { color: theme.colors.bg },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: theme.radii.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
  },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
