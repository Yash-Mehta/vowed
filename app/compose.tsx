import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { storage } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { postsCol } from '../lib/firestore';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { theme } from '../constants/theme';

const MAX_PHOTOS = 10;

export default function ComposeScreen() {
  const router = useRouter();
  const { firebaseUser, userDoc, weddingId, role } = useAuthStore();
  const [caption, setCaption] = useState('');
  const [imageURIs, setImageURIs] = useState<string[]>([]);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  function appendImages(uris: string[]) {
    setImageURIs((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
  }

  function removeImage(uri: string) {
    setImageURIs((prev) => prev.filter((u) => u !== uri));
  }

  async function pickImage() {
    Alert.alert('Add photo', undefined, [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Please allow camera access in Settings.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
          if (!result.canceled && result.assets[0]) appendImages([result.assets[0].uri]);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - imageURIs.length,
            quality: 0.85,
          });
          if (!result.canceled && result.assets.length > 0) {
            appendImages(result.assets.map((a) => a.uri));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePost() {
    if (!firebaseUser || !userDoc || !weddingId) return;
    if (!caption.trim() && imageURIs.length === 0) {
      Alert.alert('Nothing to post', 'Add a caption or photo.');
      return;
    }
    setPosting(true);
    try {
      let photoURLs: string[] = [];
      if (imageURIs.length > 0 && !isAnnouncement) {
        photoURLs = await Promise.all(
          imageURIs.map(async (uri, i) => {
            const blob = await (await fetch(uri)).blob();
            const storageRef = ref(storage, `weddings/${weddingId}/posts/${firebaseUser.uid}-${Date.now()}-${i}`);
            await uploadBytes(storageRef, blob);
            return getDownloadURL(storageRef);
          })
        );
      }
      await addDoc(postsCol(weddingId), {
        type: isAnnouncement ? 'announcement' : 'photo',
        caption: caption.trim(),
        photoURL: photoURLs[0] ?? null,
        photoURLs,
        authorId: firebaseUser.uid,
        authorName: userDoc.displayName,
        authorPhotoURL: userDoc.photoURL,
        pinned,
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not post. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New post</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={posting}
            activeOpacity={0.85}
            style={[styles.postBtn, posting && styles.postBtnDisabled]}>
            {posting ? (
              <ActivityIndicator color={theme.colors.bg} size="small" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {role === 'host' && (
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.typeBtn, !isAnnouncement && styles.typeBtnActive]}
              onPress={() => setIsAnnouncement(false)}
              activeOpacity={0.8}>
              <Text style={[styles.typeBtnText, !isAnnouncement && styles.typeBtnTextActive]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, isAnnouncement && styles.typeBtnActive]}
              onPress={() => setIsAnnouncement(true)}
              activeOpacity={0.8}>
              <Text style={[styles.typeBtnText, isAnnouncement && styles.typeBtnTextActive]}>
                Announcement
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isAnnouncement && (
          imageURIs.length === 0 ? (
            <TouchableOpacity style={styles.photoPicker} onPress={pickImage} activeOpacity={0.8}>
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>+</Text>
                <Text style={styles.photoPlaceholderText}>Add photos</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbStrip}
              contentContainerStyle={styles.thumbStripContent}>
              {imageURIs.map((uri) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removeImage(uri)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {imageURIs.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.thumbAdd} onPress={pickImage} activeOpacity={0.8}>
                  <Text style={styles.thumbAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )
        )}

        <TextInput
          style={[styles.captionInput, isAnnouncement && styles.captionInputTall]}
          value={caption}
          onChangeText={setCaption}
          placeholder={isAnnouncement ? 'Write your announcement…' : 'Write a caption…'}
          placeholderTextColor={theme.colors.ink4}
          multiline
          autoFocus
        />

        {role === 'host' && (
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Pin to top of feed</Text>
              <Text style={styles.switchSub}>Pinned posts stay at the top</Text>
            </View>
            <Switch
              value={pinned}
              onValueChange={setPinned}
              trackColor={{ false: theme.colors.surface3, true: theme.colors.accentSoft }}
              thumbColor={pinned ? theme.colors.accent : theme.colors.card}
            />
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cancel: { fontSize: 15, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.ink, fontFamily: theme.fonts.serif },
  postBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: theme.colors.accentSoft },
  postBtnText: { color: theme.colors.bg, fontWeight: '600', fontSize: 14, fontFamily: theme.fonts.sans },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radii.md,
    padding: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: theme.colors.card, ...theme.shadows.s1 },
  typeBtnText: { fontSize: 13, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  typeBtnTextActive: { color: theme.colors.ink, fontWeight: '600' },
  photoPicker: {
    height: 220,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
  },
  thumbStrip: { marginBottom: 14 },
  thumbStripContent: { gap: 10, paddingVertical: 4 },
  thumbWrap: { width: 110, height: 110 },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface2,
  },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  thumbAdd: {
    width: 110,
    height: 110,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbAddIcon: { fontSize: 28, color: theme.colors.ink4 },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderIcon: { fontSize: 36, color: theme.colors.ink4 },
  photoPlaceholderText: { fontSize: 13, color: theme.colors.ink3, marginTop: 6, fontFamily: theme.fonts.sans },
  captionInput: {
    fontSize: 15,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 18,
    lineHeight: 22,
  },
  captionInputTall: { minHeight: 140 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderColor: theme.colors.line,
    paddingTop: 16,
  },
  switchLabel: { fontSize: 14, color: theme.colors.ink, fontFamily: theme.fonts.sans, fontWeight: '500' },
  switchSub: { fontSize: 11, color: theme.colors.ink3, marginTop: 2, fontFamily: theme.fonts.sans },
});
