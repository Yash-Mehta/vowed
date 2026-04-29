import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { auth, storage } from '../../lib/firebase';
import { clearCredentials } from '../../lib/secureAuth';
import { updateUser } from '../../lib/firestore';
import { useAuthStore } from '../../store/authStore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  const { firebaseUser, userDoc, setUserDoc } = useAuthStore();
  const [displayName, setDisplayName] = useState(userDoc?.displayName ?? '');
  const [howTheyKnow, setHowTheyKnow] = useState(userDoc?.howTheyKnow ?? '');
  const [saving, setSaving] = useState(false);
  const [photoURI, setPhotoURI] = useState<string | null>(userDoc?.photoURL ?? null);

  async function pickPhoto() {
    Alert.alert('Change photo', undefined, [
      {
        text: 'Camera',
        onPress: () => openPicker(() => ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })),
      },
      {
        text: 'Photo Library',
        onPress: () => openPicker(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const [uploading, setUploading] = useState(false);

  async function openPicker(launch: () => Promise<ImagePicker.ImagePickerResult>) {
    const result = await launch();
    if (result.canceled || !result.assets[0] || !firebaseUser) return;
    setUploading(true);
    try {
      // Convert any format (HEIC, PNG, WebP, etc.) to JPEG so Storage rules always match image/*
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhotoURI(compressed.uri);
      const response = await fetch(compressed.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${firebaseUser.uid}.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(storageRef);
      await updateUser(firebaseUser.uid, { photoURL: url });
      setUserDoc({ ...userDoc!, photoURL: url });
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!firebaseUser || !displayName.trim()) return;
    setSaving(true);
    try {
      const update = { displayName: displayName.trim(), howTheyKnow: howTheyKnow.trim() };
      await updateUser(firebaseUser.uid, update);
      setUserDoc({ ...userDoc!, ...update });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await clearCredentials(); signOut(auth); } },
    ]);
  }

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>My Profile</Text>

        <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
          <Avatar uri={photoURI} name={displayName} size={88} ringed />
          <View style={styles.editBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={theme.colors.bg} />
              : <Text style={styles.editBadgeText}>Edit</Text>}
          </View>
        </TouchableOpacity>

        {userDoc?.role === 'host' && (
          <View style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>HOST</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.ink4}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>How do you know the couple?</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={howTheyKnow}
            onChangeText={(t) => setHowTheyKnow(t.slice(0, 100))}
            placeholder="e.g. Friends from college, Yash's cousin…"
            placeholderTextColor={theme.colors.ink4}
            multiline
            numberOfLines={3}
            maxLength={100}
          />
          <Text style={styles.charCount}>{howTheyKnow.length}/100</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}>
          {saving ? (
            <ActivityIndicator color={theme.colors.bg} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 80 },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
    marginBottom: 24,
  },
  avatarWrap: { alignSelf: 'center', marginBottom: 8 },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editBadgeText: { fontSize: 10, color: theme.colors.bg, fontWeight: '600', fontFamily: theme.fonts.sans },
  hostBadge: {
    alignSelf: 'center',
    marginBottom: 24,
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
  field: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.colors.ink,
    backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.sans,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 11 },
  charCount: { fontSize: 11, color: theme.colors.ink4, textAlign: 'right', marginTop: 4, fontFamily: theme.fonts.sans },
  saveBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    ...theme.shadows.s2,
  },
  saveBtnDisabled: { backgroundColor: theme.colors.accentSoft },
  saveBtnText: { color: theme.colors.bg, fontSize: 15, fontWeight: '600', fontFamily: theme.fonts.sans },
  signOutBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
});
