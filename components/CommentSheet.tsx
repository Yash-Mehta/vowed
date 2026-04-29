import { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { Avatar } from './Avatar';
import { theme } from '../constants/theme';

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  createdAt: any;
}

interface Props {
  postId: string | null;
  onClose: () => void;
}

export function CommentSheet({ postId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const { firebaseUser, userDoc } = useAuthStore();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [postId]);

  async function handleSend() {
    if (!text.trim() || !postId || !firebaseUser || !userDoc) return;
    const trimmed = text.trim();
    setText('');
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      authorId: firebaseUser.uid,
      authorName: userDoc.displayName,
      authorPhotoURL: userDoc.photoURL,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    // commentCount is incremented by the onCommentCreated Cloud Function
  }

  return (
    <Modal
      visible={!!postId}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
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
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.empty}>No comments yet. Be the first!</Text>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={theme.colors.ink4}
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },
  container: { flex: 1 },
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
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 0.5,
    borderColor: theme.colors.line,
    gap: 10,
    backgroundColor: theme.colors.card,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
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
