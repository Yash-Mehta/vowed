import { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { onSnapshotError } from '../lib/firestore';
import { Avatar } from './Avatar';
import { theme } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  createdAt: Timestamp;
}

interface Props {
  postId: string | null;
  onClose: () => void;
}

export function CommentSheet({ postId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const { firebaseUser, userDoc, weddingId } = useAuthStore();
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const unobstructedHeight = useRef(windowHeight);

  useEffect(() => {
    if (!postId) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // Seed from current state: the sheet can be opened while a keyboard is
    // already up, and a focus swap does not always fire a show event.
    setKeyboardHeight(Keyboard.metrics()?.height ?? 0);

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        useNativeDriver: false,
      }).start();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardHeight(0);
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [postId]);

  // Remember how tall the window is with no keyboard up, so the next block can
  // tell whether Android actually resized.
  useEffect(() => {
    if (keyboardHeight === 0) unobstructedHeight.current = windowHeight;
  }, [keyboardHeight, windowHeight]);

  // Android's Modal sets SOFT_INPUT_ADJUST_RESIZE on its own dialog window, so
  // the window usually shrinks by itself and padding on top of that would lift
  // the composer into mid-air. That flag is ignored under the edge-to-edge
  // display Expo 54 forces on Android 15+, and then nothing moves and the
  // keyboard sits over the composer — which is the bug. Padding unconditionally
  // (what this did) is wrong in the first case; not padding is wrong in the
  // second. Measure instead of guessing: pad only when the window did NOT
  // shrink. Same approach as components/CountryCodePicker.tsx.
  const androidKeyboardPad =
    Platform.OS === 'android' && keyboardHeight > 0 && windowHeight >= unobstructedHeight.current
      ? keyboardHeight
      : 0;

  useEffect(() => {
    if (!postId || !weddingId) return;
    const q = query(
      collection(db, 'weddings', weddingId, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, onSnapshotError);
    return unsub;
  }, [postId, weddingId]);

  async function handleSend() {
    if (!text.trim() || !postId || !firebaseUser || !userDoc || !weddingId) return;
    const trimmed = text.trim();
    setText('');
    await addDoc(collection(db, 'weddings', weddingId, 'posts', postId, 'comments'), {
      authorId: firebaseUser.uid,
      authorName: userDoc.displayName,
      authorPhotoURL: userDoc.photoURL,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  }

  // The home-indicator gap belongs under the composer only while the keyboard
  // is down; with it up, the keyboard occupies that space already. This was an
  // interpolate over inputRange [0, 1] against a value that ranges to the
  // keyboard height — it clamped to the right answer, but only by accident.
  const bottomPad = keyboardHeight > 0 ? 0 : insets.bottom;

  return (
    <Modal
      visible={!!postId}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.container,
          // iOS gets the animated lift, which matches keyboardWillShow's own
          // duration. Android gets a measured value, or zero when its window
          // already resized for us.
          { paddingBottom: Platform.OS === 'ios' ? keyboardAnim : androidKeyboardPad },
        ]}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.comment}>
              <Avatar uri={item.authorPhotoURL} name={item.authorName} size={32} />
              <View style={styles.commentBody}>
                <View style={styles.bubble}>
                  <Text style={styles.commentAuthor}>{item.authorName}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No comments yet. Be the first!</Text>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <Animated.View style={[styles.inputRow, { paddingBottom: bottomPad }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor={theme.colors.ink4}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.card },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.lineStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
  },
  close: { fontSize: 18, color: theme.colors.ink3, padding: 4 },
  comment: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentBody: { flex: 1 },
  bubble: {
    backgroundColor: theme.colors.surface2,
    padding: 10,
    borderRadius: 14,
    borderTopLeftRadius: 4,
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 2,
    color: theme.colors.ink2,
    fontFamily: theme.fonts.sans,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.ink,
    lineHeight: 20,
    fontFamily: theme.fonts.sans,
  },
  empty: {
    textAlign: 'center',
    color: theme.colors.ink3,
    fontSize: 14,
    paddingVertical: 24,
    fontFamily: theme.fonts.sans,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 0.5,
    borderColor: theme.colors.line,
    gap: 10,
    backgroundColor: theme.colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
    textAlignVertical: 'top',
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
  },
  sendBtnDisabled: { backgroundColor: theme.colors.surface3 },
  sendText: {
    color: theme.colors.bg,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: theme.fonts.sans,
  },
});
