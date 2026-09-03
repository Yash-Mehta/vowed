import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { auth, storage } from '../../lib/firebase';
import { createMember, getMember, updateMember, addWeddingToIndex, setUserProfile } from '../../lib/firestore';
import { theme } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const {
    pendingRole: role,
    pendingWeddingId,
    globalProfile,
    setUserDoc,
    setGlobalProfile,
    setPendingWeddingId,
    setUserWeddingIds,
    userWeddingIds,
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
      let existing = null;
      try {
        existing = await getMember(pendingWeddingId, uid);
      } catch {
        // Permission denied — not yet a member, proceed with join
      }
      if (existing) {
        // Already a member — never overwrite, except a host-code entry DOES
        // elevate an existing guest (same trust signal as a first-time
        // join granting host). See the matching logic in invite.tsx for
        // the signed-in path — this is the not-yet-signed-in path, where
        // this branch is reached only after phone verification instead.
        let memberDoc = existing;
        if (role === 'host' && existing.role !== 'host') {
          await updateMember(pendingWeddingId, uid, { role: 'host' });
          memberDoc = { ...existing, role: 'host' };
        }
        await addWeddingToIndex(uid, pendingWeddingId);
        setUserDoc(memberDoc);
        setUserWeddingIds(userWeddingIds.includes(pendingWeddingId) ? userWeddingIds : [...userWeddingIds, pendingWeddingId]);
        setPendingWeddingId(null);
        router.replace('/select-wedding');
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
        role,
        isSingle,
      };
      await createMember(pendingWeddingId, uid, memberData);
      await addWeddingToIndex(uid, pendingWeddingId);
      setUserDoc({ ...memberData, fcmToken: null, createdAt: null });
      setUserWeddingIds([...userWeddingIds, pendingWeddingId]);
      setPendingWeddingId(null);
      router.replace('/select-wedding');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
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
