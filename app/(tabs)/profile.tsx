import { useState } from 'react';
import { useRouter } from 'expo-router';
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
import { updateMember, deleteAccount } from '../../lib/firestore';
import { useAuthStore } from '../../store/authStore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { firebaseUser, userDoc, weddingId, setUserDoc, setWeddingId } = useAuthStore();
  const [displayName, setDisplayName] = useState(userDoc?.displayName ?? '');
  const [howTheyKnow, setHowTheyKnow] = useState(userDoc?.howTheyKnow ?? '');
  const [isSingle, setIsSingle] = useState(userDoc?.isSingle ?? false);
  const [saving, setSaving] = useState(false);
  const [photoURI, setPhotoURI] = useState<string | null>(userDoc?.photoURL ?? null);

  async function pickPhoto() {
    Alert.alert('Change photo', undefined, [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Please allow camera access in Settings.');
            return;
          }
          openPicker(() => ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 }));
        },
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
      if (weddingId) await updateMember(weddingId, firebaseUser.uid, { photoURL: url });
      setUserDoc({ ...userDoc!, photoURL: url });
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSingleToggle(value: boolean) {
    setIsSingle(value);
    if (!firebaseUser || !weddingId) return;
    try {
      await updateMember(weddingId, firebaseUser.uid, { isSingle: value });
      setUserDoc({ ...userDoc!, isSingle: value });
    } catch (e: any) {
      setIsSingle(!value);
      Alert.alert('Error', e?.message ?? 'Could not update. Please try again.');
    }
  }

  async function handleSave() {
    if (!firebaseUser || !displayName.trim()) return;
    setSaving(true);
    try {
      if (!weddingId) return;
      const update = { displayName: displayName.trim(), howTheyKnow: howTheyKnow.trim() };
      await updateMember(weddingId, firebaseUser.uid, update);
      setUserDoc({ ...userDoc!, ...update });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and remove you from this wedding. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!firebaseUser) return;
            try {
              await deleteAccount(firebaseUser.uid, weddingId ?? null);
              await clearCredentials();
              useAuthStore.getState().clear();
              await auth.currentUser?.delete();
            } catch (e: any) {
              if (e?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication required',
                  'Please sign out and sign back in, then try deleting your account again.'
                );
                return;
              }
              throw e;
            }
          },
        },
      ]
    );
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
            placeholder="e.g. College friends, cousin of the bride…"
            placeholderTextColor={theme.colors.ink4}
            multiline
            numberOfLines={3}
            maxLength={100}
          />
          <Text style={styles.charCount}>{howTheyKnow.length}/100</Text>
        </View>

        <TouchableOpacity
          style={[styles.singleCard, isSingle && styles.singleCardActive]}
          onPress={() => handleSingleToggle(!isSingle)}
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

        <TouchableOpacity
          style={styles.switchPartyBtn}
          onPress={() => { setWeddingId(null); }}
          activeOpacity={0.7}>
          <Text style={styles.switchPartyText}>Switch wedding party</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.legalBtn} onPress={() => router.push('/privacy')} activeOpacity={0.7}>
          <Text style={styles.legalText}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Text style={styles.deleteAccountText}>Delete account</Text>
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
  singleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 18,
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
  switchPartyBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  switchPartyText: { fontSize: 14, color: theme.colors.accent, fontFamily: theme.fonts.sans, fontWeight: '500' },
  signOutBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  legalBtn: { alignItems: 'center', paddingVertical: 8 },
  legalText: { fontSize: 12, color: theme.colors.ink4, fontFamily: theme.fonts.sans, textDecorationLine: 'underline' },
  deleteAccountBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  deleteAccountText: { fontSize: 12, color: theme.colors.ink4, fontFamily: theme.fonts.sans, textDecorationLine: 'underline' },
});
