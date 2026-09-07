import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { auth, storage } from '../../lib/firebase';
import { createMember, getMember, claimHostRole, addWeddingToIndex, setUserProfile, UserDoc, UserRole } from '../../lib/firestore';
import { theme } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const {
    pendingRole: role,
    pendingWeddingId,
    pendingCode,
    globalProfile,
    setUserDoc,
    setGlobalProfile,
    setPendingWeddingId,
    setPendingCode,
    setUserWeddingIds,
    userWeddingIds,
    switchWedding,
  } = useAuthStore();
  // A non-empty displayName on the global profile means this account has
  // already set up a profile (on this wedding or another) — skip asking
  // for name/photo again and only collect what's actually wedding-specific.
  const isReturningUser = !!globalProfile?.displayName;

  const [displayName, setDisplayName] = useState('');
  const [howTheyKnow, setHowTheyKnow] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSingle, setIsSingle] = useState(false);
  const [loading, setLoading] = useState(false);
  // Gates the form behind the mount-time guard below — the form must never
  // render until we know this user actually needs to fill it in.
  const [checking, setChecking] = useState(true);

  // Applies to an account that already has a member doc for this wedding.
  // Never demotes; a host code still elevates an existing guest, matching
  // invite.tsx's signed-in path (this is the signed-out equivalent).
  async function settleExistingMember(uid: string, weddingId: string, existing: UserDoc) {
    let memberDoc = existing;
    let elevated = false;
    if (role === 'host' && existing.role !== 'host' && pendingCode) {
      await claimHostRole(weddingId, pendingCode);
      memberDoc = { ...existing, role: 'host' };
      elevated = true;
    }
    await addWeddingToIndex(uid, weddingId);
    setUserDoc(memberDoc);
    setUserWeddingIds(userWeddingIds.includes(weddingId) ? userWeddingIds : [...userWeddingIds, weddingId]);
    setPendingWeddingId(null);
    setPendingCode(null);
    Alert.alert(
      elevated ? 'Host access granted' : 'Already joined',
      elevated
        ? "You've been given host access to this wedding."
        : "You're already part of this wedding."
    );
    router.replace('/select-wedding');
  }

  // Mount-time guard. This check used to live only inside handleComplete(),
  // which meant an existing member was shown the join form, forced to
  // invent a required "how do you know the couple" answer, and only then
  // silently bounced — with the answer discarded. Everything that makes
  // this screen unusable is now resolved before it renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = auth.currentUser?.uid;
      // Signed out: handleComplete would hit `if (!uid) return` and no-op
      // forever, leaving an inert button with no feedback.
      if (!uid) {
        router.replace('/(auth)/phone');
        return;
      }
      // No wedding to join — the root layout deliberately does not redirect
      // away from this screen, so without this it becomes a dead end that
      // only reveals the problem after the form is submitted.
      if (!pendingWeddingId) {
        router.replace(userWeddingIds.length > 0 ? '/select-wedding' : '/(auth)/invite');
        return;
      }
      let existing: UserDoc | null = null;
      try {
        existing = await getMember(pendingWeddingId, uid);
      } catch (e: any) {
        // permission-denied is the expected "not a member yet" signal —
        // firestore.rules gates member reads on isMember. Any other error
        // (offline, unavailable) must NOT be read as "not a member": that
        // would fall through to createMember, which is a non-merging
        // setDoc, overwriting a real member doc and demoting a host.
        if (e?.code !== 'permission-denied') {
          if (cancelled) return;
          Alert.alert('Connection problem', 'Could not load this wedding. Please check your connection and try again.');
          router.replace(userWeddingIds.length > 0 ? '/select-wedding' : '/(auth)/invite');
          return;
        }
      }
      if (cancelled) return;
      if (existing) {
        await settleExistingMember(uid, pendingWeddingId, existing);
        return;
      }
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function pickAvatar() {
    Alert.alert('Add photo', undefined, [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Please allow camera access in Settings.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled) setAvatarUri(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled) setAvatarUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function uploadAvatar(uid: string, uri: string): Promise<string> {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(compressed.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `avatars/${uid}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  }

  async function handleComplete() {
    if (!howTheyKnow.trim() || (!isReturningUser && !displayName.trim())) {
      Alert.alert('Required', isReturningUser
        ? 'Please fill in how you know the couple.'
        : 'Please fill in your name and how you know the couple.');
      return;
    }
    if (!pendingWeddingId) {
      Alert.alert('Error', 'Wedding not found. Please go back and try your invite code again.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      // Re-check on submit as well as on mount — the mount guard handles
      // the common case, this closes the window where membership changed
      // (or another device joined) while the form was open.
      let existing: UserDoc | null = null;
      try {
        existing = await getMember(pendingWeddingId, uid);
      } catch (e: any) {
        // Only permission-denied means "not a member" — see the mount
        // guard above for why anything else must abort rather than fall
        // through to the non-merging createMember below.
        if (e?.code !== 'permission-denied') {
          Alert.alert('Connection problem', 'Could not save right now. Please check your connection and try again.');
          return;
        }
      }
      if (existing) {
        await settleExistingMember(uid, pendingWeddingId, existing);
        return;
      }

      let name: string;
      let photoURL: string | null;
      if (isReturningUser && globalProfile) {
        name = globalProfile.displayName;
        photoURL = globalProfile.photoURL;
      } else {
        name = displayName.trim();
        photoURL = avatarUri ? await uploadAvatar(uid, avatarUri) : null;
        // Seed the global profile so future weddings this account joins
        // skip this form entirely.
        await setUserProfile(uid, { displayName: name, photoURL });
        setGlobalProfile({ displayName: name, photoURL, phoneNumber: globalProfile?.phoneNumber ?? null });
      }

      const memberData = {
        displayName: name,
        howTheyKnow: howTheyKnow.trim(),
        photoURL,
        role: 'guest' as UserRole,
        isSingle,
      };
      await createMember(pendingWeddingId, uid, memberData);
      // Register the wedding before attempting elevation, so a failed claim
      // still leaves a complete, working guest membership rather than a member
      // doc the account index doesn't know about.
      await addWeddingToIndex(uid, pendingWeddingId);
      // Rules only ever accept a client-written 'guest'. A host code is
      // redeemed server-side by claimHostRole, which re-validates it.
      if (role === 'host') {
        try {
          if (!pendingCode) throw new Error('missing code');
          await claimHostRole(pendingWeddingId, pendingCode);
          memberData.role = 'host';
        } catch {
          // They are already in the wedding at this point — don't strand them
          // on the form over a failed upgrade they can retry or ask a host for.
          Alert.alert(
            'Joined as a guest',
            "You're in, but host access couldn't be granted just now. Re-enter the host code, or ask a host to promote you."
          );
        }
      }
      setUserWeddingIds(
        userWeddingIds.includes(pendingWeddingId) ? userWeddingIds : [...userWeddingIds, pendingWeddingId]
      );
      setPendingWeddingId(null);
      setPendingCode(null);
      // Drop them straight into the wedding they just joined, matching the
      // host path in confirm.tsx — landing on a one-card party picker that
      // has to be tapped again is a pointless extra step.
      switchWedding(pendingWeddingId, { ...memberData, fcmToken: null, createdAt: null });
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  // Never show the join form until the guard has confirmed this user is
  // actually a new member of this wedding.
  if (checking) {
    return (
      <View style={styles.checking}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isReturningUser ? 'Join this wedding' : 'Set up your profile'}</Text>

      {!isReturningUser && (
        <>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>Add photo</Text>
              </View>
            )}
            <Text style={styles.changePhoto}>Tap to add photo</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.ink4}
          />
        </>
      )}

      <TextInput
        style={[styles.input, styles.multiline]}
        value={howTheyKnow}
        onChangeText={(t) => setHowTheyKnow(t.slice(0, 100))}
        placeholder="How do you know the couple? (e.g. college friends with Sarah)"
        placeholderTextColor={theme.colors.ink4}
        multiline
        numberOfLines={3}
      />
      <Text style={styles.charCount}>{howTheyKnow.length}/100</Text>

      <TouchableOpacity
        style={[styles.singleCard, isSingle && styles.singleCardActive]}
        onPress={() => setIsSingle(v => !v)}
        activeOpacity={0.75}>
        <View style={styles.singleCardInner}>
          <Text style={[styles.singleCardTitle, isSingle && styles.singleCardTitleActive]}>
            Single & ready to mingle
          </Text>
          <Text style={styles.singleCardSub}>
            Let your fellow guests know you're available
          </Text>
        </View>
        <View style={[styles.singleDot, isSingle && styles.singleDotActive]}>
          {isSingle && <Text style={styles.singleCheck}>✓</Text>}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Saving…' : "Let's go"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => {
        setPendingWeddingId(null);
        router.replace('/(auth)/invite');
      }} activeOpacity={0.7}>
        <Text style={styles.backText}>Go back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 32, paddingTop: 80 },
  checking: { flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, color: theme.colors.ink, fontFamily: theme.fonts.serif },
  avatarContainer: { alignSelf: 'center', marginBottom: 24, alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.surface2,
    justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: theme.colors.line,
  },
  avatarPlaceholderText: { fontSize: 12, color: theme.colors.ink3, fontFamily: theme.fonts.serif },
  changePhoto: { fontSize: 13, color: theme.colors.accentSoft, marginTop: 8, fontFamily: theme.fonts.sans },
  input: {
    borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: theme.radii.md,
    padding: 16, fontSize: 16, marginBottom: 12, backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.sans, color: theme.colors.ink, letterSpacing: 0,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: theme.colors.ink4, textAlign: 'right', marginBottom: 16, fontFamily: theme.fonts.sans },
  singleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 24,
    backgroundColor: theme.colors.card,
  },
  singleCardActive: {
    borderColor: '#E8B84B',
    backgroundColor: '#FEFAEF',
  },
  singleCardInner: { flex: 1 },
  singleCardTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.ink2,
    marginBottom: 2,
  },
  singleCardTitleActive: { color: '#B8860B' },
  singleCardSub: {
    fontSize: 12,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink4,
    lineHeight: 16,
  },
  singleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleDotActive: { borderColor: '#E8B84B', backgroundColor: '#E8B84B' },
  singleCheck: { fontSize: 11, color: '#fff', fontWeight: '700' },
  button: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, padding: 16, alignItems: 'center' },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  backBtn: { paddingVertical: 16, alignItems: 'center' },
  backText: { color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
});
