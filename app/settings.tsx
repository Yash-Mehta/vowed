import { useState, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { getMember, getWeddingPreviews, updateMember, setUserProfile } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Avatar } from '../components/Avatar';
import { theme } from '../constants/theme';

interface PartyNotifPrefs {
  weddingId: string;
  coupleName: string;
  notifyPosts: boolean;
  notifyComments: boolean;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { firebaseUser, globalProfile, userWeddingIds, setGlobalProfile } = useAuthStore();

  const [displayName, setDisplayName] = useState(globalProfile?.displayName ?? '');
  const [photoURI, setPhotoURI] = useState<string | null>(globalProfile?.photoURL ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [parties, setParties] = useState<PartyNotifPrefs[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || userWeddingIds.length === 0) {
      setLoadingParties(false);
      return;
    }
    Promise.all([
      getWeddingPreviews(userWeddingIds),
      Promise.all(userWeddingIds.map((weddingId) => getMember(weddingId, uid))),
    ])
      .then(([previews, members]) => {
        const previewByWeddingId = new Map(previews.map((p) => [p.weddingId, p]));
        const combined = userWeddingIds
          .map((weddingId, i) => {
            const preview = previewByWeddingId.get(weddingId);
            const member = members[i];
            if (!preview || !member) return null;
            return {
              weddingId,
              coupleName: preview.coupleName,
              notifyPosts: member.notifyPosts !== false,
              notifyComments: member.notifyComments !== false,
            };
          })
          .filter((p): p is PartyNotifPrefs => p !== null);
        setParties(combined);
      })
      .finally(() => setLoadingParties(false));
  }, [firebaseUser?.uid, userWeddingIds]);

  async function handleNotifyToggle(
    weddingId: string,
    field: 'notifyPosts' | 'notifyComments',
    value: boolean
  ) {
    if (!firebaseUser) return;
    setParties((prev) =>
      prev.map((p) => (p.weddingId === weddingId ? { ...p, [field]: value } : p))
    );
    try {
      await updateMember(weddingId, firebaseUser.uid, { [field]: value });
    } catch {
      setParties((prev) =>
        prev.map((p) => (p.weddingId === weddingId ? { ...p, [field]: !value } : p))
      );
      Alert.alert('Error', 'Could not update notification settings. Please try again.');
    }
  }

  function pickPhoto() {
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

  async function openPicker(launch: () => Promise<ImagePicker.ImagePickerResult>) {
    const result = await launch();
    if (result.canceled || !result.assets[0] || !firebaseUser) return;
    setUploading(true);
    try {
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
      await setUserProfile(firebaseUser.uid, { displayName, photoURL: url });
      setGlobalProfile({ displayName, photoURL: url });
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
      const name = displayName.trim();
      await setUserProfile(firebaseUser.uid, { displayName: name, photoURL: photoURI });
      setGlobalProfile({ displayName: name, photoURL: photoURI });
      Alert.alert('Saved', 'Your profile has been updated everywhere you\'re a guest or host.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenWrapper>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.ink} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionEyebrow}>YOUR PROFILE</Text>
        <Text style={styles.sectionSub}>
          Applies across every wedding you're part of.
        </Text>

        <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
          <Avatar uri={photoURI} name={displayName} size={88} ringed />
          <View style={styles.editBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={theme.colors.bg} />
              : <Text style={styles.editBadgeText}>Edit</Text>}
          </View>
        </TouchableOpacity>

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

        <Text style={[styles.sectionEyebrow, styles.notifSectionEyebrow]}>NOTIFICATIONS</Text>
        <Text style={styles.sectionSub}>
          Set independently for each wedding party.
        </Text>

        {loadingParties ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 12 }} />
        ) : parties.length === 0 ? (
          <Text style={styles.emptyText}>You're not part of any wedding parties yet.</Text>
        ) : (
          parties.map((party) => (
            <View key={party.weddingId} style={styles.partyCard}>
              <Text style={styles.partyName}>{party.coupleName}</Text>

              <View style={styles.notifRow}>
                <View style={styles.notifText}>
                  <Text style={styles.notifTitle}>New photo posts</Text>
                  <Text style={styles.notifSub}>When someone shares a photo</Text>
                </View>
                <Switch
                  value={party.notifyPosts}
                  onValueChange={(v) => handleNotifyToggle(party.weddingId, 'notifyPosts', v)}
                  trackColor={{ false: theme.colors.surface3, true: theme.colors.accentSoft }}
                  thumbColor={party.notifyPosts ? theme.colors.accent : theme.colors.card}
                />
              </View>

              <View style={[styles.notifRow, styles.notifRowLast]}>
                <View style={styles.notifText}>
                  <Text style={styles.notifTitle}>Comments on your posts</Text>
                  <Text style={styles.notifSub}>When someone comments on your post</Text>
                </View>
                <Switch
                  value={party.notifyComments}
                  onValueChange={(v) => handleNotifyToggle(party.weddingId, 'notifyComments', v)}
                  trackColor={{ false: theme.colors.surface3, true: theme.colors.accentSoft }}
                  thumbColor={party.notifyComments ? theme.colors.accent : theme.colors.card}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans, color: theme.colors.ink },
  scroll: { padding: 24, paddingTop: 8, paddingBottom: 80 },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.2,
    color: theme.colors.gold,
    fontFamily: theme.fonts.sans,
    marginBottom: 4,
  },
  notifSectionEyebrow: { marginTop: 32 },
  sectionSub: {
    fontSize: 13,
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
    marginBottom: 20,
  },
  avatarWrap: { alignSelf: 'center', marginBottom: 24 },
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
  saveBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    ...theme.shadows.s2,
  },
  saveBtnDisabled: { backgroundColor: theme.colors.accentSoft },
  saveBtnText: { color: theme.colors.bg, fontSize: 15, fontWeight: '600', fontFamily: theme.fonts.sans },
  emptyText: { fontSize: 14, color: theme.colors.ink4, fontFamily: theme.fonts.sans, textAlign: 'center', marginTop: 8 },
  partyCard: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.lg,
    padding: 16,
    paddingBottom: 4,
    marginBottom: 14,
    backgroundColor: theme.colors.card,
  },
  partyName: { fontSize: 16, fontFamily: theme.fonts.serif, color: theme.colors.ink, marginBottom: 8 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.line,
  },
  notifRowLast: { borderBottomWidth: 0 },
  notifText: { flex: 1, marginRight: 12 },
  notifTitle: { fontSize: 14, color: theme.colors.ink, fontFamily: theme.fonts.sans, fontWeight: '500' },
  notifSub: { fontSize: 11, color: theme.colors.ink4, marginTop: 2, fontFamily: theme.fonts.sans, lineHeight: 15 },
});
