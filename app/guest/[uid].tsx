import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useGoBack } from '../../hooks/useGoBack';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserDoc, onSnapshotError } from '../../lib/firestore';
import { useAuthStore } from '../../store/authStore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { ImageViewer } from '../../components/ImageViewer';
import { PARTY_ROLE_LABELS, toPartyRole } from '../../lib/partyRoles';
import { theme } from '../../constants/theme';

export default function GuestProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { weddingId } = useAuthStore();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoOpen, setPhotoOpen] = useState(false);
  const goBack = useGoBack('/(tabs)/guests');

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

  const partyRole = toPartyRole(user.partyRole);

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={goBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          {/* Only tappable when there is a photo — opening a viewer on the
              initials placeholder would show a blank screen. */}
          <Pressable
            onPress={() => setPhotoOpen(true)}
            disabled={!user.photoURL}
            accessibilityRole={user.photoURL ? 'imagebutton' : undefined}
            accessibilityLabel={user.photoURL ? `View ${user.displayName}'s photo` : undefined}>
            <Avatar uri={user.photoURL} name={user.displayName} size={100} ringed />
          </Pressable>
          <Text style={styles.name}>{user.displayName}</Text>

          {/* Two independent axes: role is authorization, partyRole is where
              they sit in the wedding. Someone can be both, so these are
              separate pills rather than one. 'guest' is the unmarked default
              and gets no pill — a badge on everyone distinguishes nobody. */}
          {(user.role === 'host' || partyRole !== 'guest') && (
            <View style={styles.badges}>
              {user.role === 'host' && (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>HOST</Text>
                </View>
              )}
              {partyRole !== 'guest' && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {PARTY_ROLE_LABELS[partyRole].toUpperCase()}
                  </Text>
                </View>
              )}
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

      <ImageViewer
        uri={user.photoURL}
        name={user.displayName}
        visible={photoOpen}
        onClose={() => setPhotoOpen(false)}
      />
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  hostBadge: {
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
  // Gold, where HOST is accent-tinted: the two pills carry different kinds of
  // information and should not read as the same kind of label.
  roleBadge: {
    backgroundColor: theme.colors.goldTint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.gold,
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
