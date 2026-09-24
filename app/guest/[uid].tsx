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
import { onSnapshotError } from '../../lib/firestore';
import { GuestEntry, toEntry } from '../../lib/guestSections';
import { useAuthStore } from '../../store/authStore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { ImageViewer } from '../../components/ImageViewer';
import { PARTY_ROLE_LABELS } from '../../lib/partyRoles';
import { theme } from '../../constants/theme';

export default function GuestProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { weddingId } = useAuthStore();
  const [user, setUser] = useState<GuestEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoOpen, setPhotoOpen] = useState(false);
  const goBack = useGoBack('/(tabs)/guests');

  useEffect(() => {
    // A bare return here left `loading` true forever — the same defect this
    // branch fixed in (tabs)/guests.tsx. Reachable on a cold start onto this
    // route before authStore.weddingId has hydrated: the redirect usually wins
    // the race, but when it does not the screen spins with nothing behind it.
    if (!uid || !weddingId) {
      setUser(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'weddings', weddingId, 'members', uid), (snap) => {
      // Normalised, never cast. `as UserDoc` was a compile-time assertion over
      // a client-written document: rules constrain only role/partyRole/
      // isCouple, so a member could drop their own displayName and every other
      // guest's app would throw inside Avatar's name.split(' '). There is no
      // error boundary, so that unmounts the React root — a blank screen until
      // the app is force-quit.
      setUser(snap.exists() ? toEntry({ uid, ...snap.data() }) : null);
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [uid, weddingId]);

  // The Modal no longer closes itself when the photo disappears, so the parent
  // does it — otherwise the viewer would sit open on the "no longer available"
  // message after a live profile update removed the picture.
  useEffect(() => {
    if (!user?.photoURL) setPhotoOpen(false);
  }, [user?.photoURL]);

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

  const partyRole = user.partyRole;

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
            // `disabled` only stamps accessibilityState.disabled; it does not
            // remove the node, so without this a screen reader stopped on the
            // initials circle and announced it as a dimmed button that does
            // nothing.
            accessible={!!user.photoURL}
            accessibilityRole={user.photoURL ? 'imagebutton' : undefined}
            accessibilityLabel={user.photoURL ? `View ${user.name}'s photo` : undefined}>
            <Avatar uri={user.photoURL} name={user.name} size={100} ringed />
          </Pressable>
          <Text style={styles.name}>{user.name}</Text>

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

        {user.blurb ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>HOW THEY KNOW THE COUPLE</Text>
            <Text style={styles.cardBody}>{user.blurb}</Text>
          </View>
        ) : null}
      </ScrollView>

      <ImageViewer
        uri={user.photoURL}
        name={user.name}
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
