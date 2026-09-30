import { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
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
  // Selector form, so this re-renders only when visibility flips rather than on
  // every frame of the keyboard animation — the avoidance itself is driven
  // natively by KeyboardAvoidingView below.
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

  // Deliberately NOT measuring the keyboard from JS here. Every previous
  // attempt in this file was structurally unable to work, and the temptation to
  // re-add one is why this note is long:
  //
  //  * `Keyboard.addListener` never fires inside an Android <Modal>. The
  //    emitter is ReactRootView's CustomGlobalLayoutListener, installed on the
  //    ACTIVITY window's view tree; a Modal's content is a DialogRootViewGroup
  //    (a ReactViewGroup, not a ReactRootView) living on its own Dialog window.
  //    `keyboardHeight` was therefore permanently 0 on Android, and
  //    `Keyboard.metrics()` is no escape hatch — it returns only what that same
  //    never-delivered event would have populated.
  //  * The old shrink-detector (`windowHeight >= unobstructedHeight.current`)
  //    was a tautology. `useWindowDimensions()` reads the Activity's
  //    CONFIGURATION metrics, which have never tracked IME visibility on
  //    Android, so it compared x >= x and could never be false.
  //  * RN turns edge-to-edge on for the Dialog window itself, which makes the
  //    SOFT_INPUT_ADJUST_RESIZE it sets inert — so the window does not resize
  //    on its own either, on Android 11-14 as much as on 15+.
  //  * `presentationStyle="pageSheet"` is literally `= Unit` on Android.
  //
  // Two workarounds that lived here are gone with the measurement, because both
  // existed only to paper over that blindness: a teardown that forced the
  // padding back to 0 in case a hide event was dropped after the listeners were
  // removed, and a rotation special case that gave up on padding whenever the
  // width changed while the keyboard was up, because the no-keyboard baseline
  // belonged to the previous orientation. There is no baseline and no padding
  // state to get stuck any more; the library observes the Dialog's window
  // directly and drives the padding on the UI thread.

  // Keeping the newest comment in view when the keyboard opens used to live in
  // the (never-firing) keyboardDidShow listener. The list's own
  // onContentSizeChange cannot stand in for it: the content does not change
  // size, only the viewport shrinks, so the offset that was at the bottom is
  // suddenly a keyboard's height short of it.
  useEffect(() => {
    if (!postId || !isKeyboardVisible) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [postId, isKeyboardVisible]);

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
  // is down; with it up, the keyboard occupies that space already. Same rule as
  // before, now asked of a source that actually answers inside a Modal.
  const bottomPad = isKeyboardVisible ? 0 : insets.bottom;

  return (
    <Modal
      visible={!!postId}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {/* behavior="padding" is exact parity with what this file used to do by
          hand: pad the flex: 1 container so the FlatList shrinks and the
          composer rides up with the keyboard. One code path for both platforms
          — iOS behaved correctly before and still gets the same padding, timed
          off the real keyboard animation. */}
      <KeyboardAvoidingView style={styles.container} behavior="padding">
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
        <View style={[styles.inputRow, { paddingBottom: bottomPad }]}>
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
        </View>
      </KeyboardAvoidingView>
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
