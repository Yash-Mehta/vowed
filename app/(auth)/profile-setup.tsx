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
import { createMember, getMember, addWeddingToIndex } from '../../lib/firestore';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { pendingRole: role, pendingWeddingId, setUserDoc, setPendingWeddingId, setUserWeddingIds, userWeddingIds } = useAuthStore();
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
    if (!displayName.trim() || !howTheyKnow.trim()) {
      Alert.alert('Required', 'Please fill in your name and how you know the couple.');
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
      const existing = await getMember(pendingWeddingId, uid);
      if (existing) {
        // Already a member — never overwrite, especially don't demote a host to guest
        await addWeddingToIndex(uid, pendingWeddingId);
        setUserDoc(existing);
        setUserWeddingIds(userWeddingIds.includes(pendingWeddingId) ? userWeddingIds : [...userWeddingIds, pendingWeddingId]);
        setPendingWeddingId(null);
        router.replace('/select-wedding');
        return;
      }
      let photoURL: string | null = null;
      if (avatarUri) photoURL = await uploadAvatar(uid, avatarUri);
      const memberData = {
        displayName: displayName.trim(),
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
      <Text style={styles.title}>Set up your profile</Text>

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
    fontFamily: theme.fonts.sans, color: theme.colors.ink,
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
