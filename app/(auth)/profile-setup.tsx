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
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/authStore';
import { auth, storage } from '../../lib/firebase';
import { createMember, createUserIndex } from '../../lib/firestore';
import { saveWeddingId } from '../../lib/secureAuth';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const { pendingRole: role, pendingWeddingId, setUserDoc, setWeddingId } = useAuthStore();
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
      await createUserIndex(uid, pendingWeddingId);
      await saveWeddingId(pendingWeddingId);
      setWeddingId(pendingWeddingId);
      setUserDoc({ ...memberData, fcmToken: null, createdAt: null });
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

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>I'm single</Text>
        <Switch
          value={isSingle}
          onValueChange={setIsSingle}
          trackColor={{ false: theme.colors.line, true: '#E8B84B' }}
          thumbColor={theme.colors.card}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Saving…' : "Let's go"}</Text>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  toggleLabel: { fontSize: 15, color: theme.colors.ink, fontFamily: theme.fonts.sans },
  button: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, padding: 16, alignItems: 'center' },
  buttonText: { color: theme.colors.bg, fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
});
