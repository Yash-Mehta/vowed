import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { createMember, addWeddingToIndex } from '../../lib/firestore';
import { theme } from '../../constants/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ConfirmScreen() {
  const router = useRouter();
  const { setWeddingId, setUserDoc, setUserWeddingIds, userWeddingIds } = useAuthStore();
  const { draft, reset } = useOnboardingStore();
  const [loading, setLoading] = useState(false);

  async function handleLaunch() {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'Please sign in again.');
      return;
    }
    if (!draft.coupleName || !draft.weddingDateISO || !draft.venue) {
      Alert.alert('Incomplete', 'Please go back and fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const weddingId = `${Date.now()}-${uid.slice(0, 6)}`;

      // Create wedding doc
      await setDoc(doc(db, 'weddings', weddingId), {
        weddingId,
        coupleName: draft.coupleName,
        coupleNameFull: draft.coupleNameFull,
        person1First: draft.person1First,
        person2First: draft.person2First,
        monogramInitials: draft.monogramInitials,
        weddingDateISO: draft.weddingDateISO,
        firstEventDateISO: draft.firstEventDateISO || draft.weddingDateISO,
        dateStamp: draft.dateStamp,
        shortDate: draft.shortDate,
        displayDate: draft.displayDate,
        venue: draft.venue,
        venueShort: draft.venueShort || draft.venue,
        location: draft.location,
        hashtag: `#${draft.person1First}${draft.person2First}Wedding`,
        registryUrl: draft.registryUrl || null,
        accentHex: draft.accentHex,
        accentDeepHex: draft.accentDeepHex,
        accentSoftHex: draft.accentSoftHex,
        accentTintHex: draft.accentTintHex,
        coverPhotoURL: null,
        guestInviteCode: draft.guestInviteCode,
        hostInviteCode: draft.hostInviteCode,
        createdAt: serverTimestamp(),
        ownerUid: uid,
      });

      // Create invite code index docs
      await setDoc(doc(db, 'weddingsByCode', draft.guestInviteCode), {
        weddingId,
        role: 'guest',
        preview: {
          coupleName: draft.coupleName,
          dateStamp: draft.shortDate,
          venue: draft.venueShort || draft.venue,
          monogramInitials: draft.monogramInitials,
        },
      });
      await setDoc(doc(db, 'weddingsByCode', draft.hostInviteCode), {
        weddingId,
        role: 'host',
        preview: {
          coupleName: draft.coupleName,
          dateStamp: draft.shortDate,
          venue: draft.venueShort || draft.venue,
          monogramInitials: draft.monogramInitials,
        },
      });

      // Register host as first member
      await createMember(weddingId, uid, {
        displayName: draft.ownerName,
        howTheyKnow: 'Host',
        photoURL: null,
        role: 'host',
      });

      await addWeddingToIndex(uid, weddingId);
      setUserWeddingIds([...userWeddingIds, weddingId]);
      setWeddingId(weddingId);
      setUserDoc({
        displayName: draft.ownerName,
        howTheyKnow: 'Host',
        photoURL: null,
        role: 'host',
        fcmToken: null,
        createdAt: null,
      });

      reset();
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create your wedding. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.progress}>
        {[...Array(4)].map((_, i) => (
          <View key={i} style={[styles.dot, styles.dotDone]} />
        ))}
      </View>

      <Text style={styles.eyebrow}>Almost there</Text>
      <Text style={styles.title}>Review your wedding</Text>
      <Text style={styles.sub}>Everything look good? You can edit these later in Admin settings.</Text>

      <View style={styles.card}>
        <Text style={styles.cardSection}>THE COUPLE</Text>
        <Row label="Names" value={draft.coupleName || '—'} />
        <Row label="Monogram" value={draft.monogramInitials || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardSection}>DATE & VENUE</Text>
        <Row label="Wedding date" value={draft.dateStamp || '—'} />
        <Row label="Venue" value={draft.venue || '—'} />
        <Row label="Location" value={draft.location || '—'} />
        {draft.registryUrl ? <Row label="Registry" value={draft.registryUrl} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardSection}>INVITE CODES</Text>
        <Row label="Guest code" value={draft.guestInviteCode || '—'} />
        <Row label="Host code" value={draft.hostInviteCode || '—'} />
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleLaunch}
        disabled={loading}
        activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color={theme.colors.bg} />
          : <Text style={styles.btnText}>Launch my wedding</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back to edit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 32, paddingTop: 64, paddingBottom: 60 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: theme.colors.line },
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
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radii.lg,
    padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: theme.colors.line,
    ...theme.shadows.s1,
  },
  cardSection: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
    color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 12,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 0.5, borderColor: theme.colors.surface2,
  },
  rowLabel: { fontSize: 12, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  rowValue: {
    fontSize: 13, color: theme.colors.ink, fontFamily: theme.fonts.sans,
    fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 12,
  },
  btn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: theme.colors.accentSoft },
  btnText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  back: { padding: 16, alignItems: 'center', marginTop: 4 },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
