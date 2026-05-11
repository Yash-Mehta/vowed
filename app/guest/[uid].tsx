import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserDoc, onSnapshotError } from '../../lib/firestore';
import { useAuthStore } from '../../store/authStore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../constants/theme';

export default function GuestProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { weddingId } = useAuthStore();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!uid || !weddingId) return;
    const unsub = onSnapshot(doc(db, 'weddings', weddingId, 'members', uid), (snap) => {
      setUser(snap.exists() ? (snap.data() as UserDoc) : null);
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [uid, weddingId]);

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.accent} />
      </ScreenWrapper>
    );
  }

  if (!user) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={styles.missing}>Guest not found</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <Avatar uri={user.photoURL} name={user.displayName} size={100} ringed />
          <Text style={styles.name}>{user.displayName}</Text>
          {user.role === 'host' && (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>HOST</Text>
            </View>
          )}
        </View>

        {user.howTheyKnow ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>HOW THEY KNOW THE COUPLE</Text>
            <Text style={styles.cardBody}>{user.howTheyKnow}</Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 60 },
  back: { marginBottom: 24 },
  backText: { fontSize: 15, color: theme.colors.accent, fontFamily: theme.fonts.sans },
  hero: { alignItems: 'center', marginBottom: 28 },
  name: {
    fontSize: 26,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    marginTop: 14,
    textAlign: 'center',
  },
  hostBadge: {
    marginTop: 8,
    backgroundColor: theme.colors.accentTint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: 16,
    borderWidth: 0.5,
    borderColor: theme.colors.line,
    ...theme.shadows.s1,
  },
  cardEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 15,
    color: theme.colors.ink,
    lineHeight: 22,
    fontFamily: theme.fonts.sans,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  missing: { fontSize: 16, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
});
