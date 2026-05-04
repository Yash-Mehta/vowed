import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Avatar } from './Avatar';
import { Post } from './PostCard';
import { theme } from '../constants/theme';

interface Props {
  post: Post;
  isHost?: boolean;
  onTogglePin?: () => void;
  onDelete?: () => void;
  onEdit?: (newCaption: string) => void;
}

export function AnnouncementCard({ post, isHost, onTogglePin, onDelete, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onEdit?.(trimmed);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(post.caption);
    setEditing(false);
  }

  function openMenu() {
    Alert.alert('Announcement options', undefined, [
      { text: post.pinned ? 'Unpin' : 'Pin to top', onPress: onTogglePin },
      { text: 'Edit', onPress: () => setEditing(true) },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.card}>
      {post.pinned && (
        <View style={styles.pinnedBar}>
          <Text style={styles.pinnedText}>✦  Pinned</Text>
        </View>
      )}
      <View style={styles.inner}>
        <View style={styles.header}>
          <Avatar uri={post.authorPhotoURL} name={post.authorName} size={32} />
          <Text style={styles.authorName}>{post.authorName}</Text>
          {isHost && (
            <TouchableOpacity onPress={openMenu} activeOpacity={0.7} style={styles.menuBtn}>
              <Text style={styles.menuBtnText}>· · ·</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholderTextColor={theme.colors.ink4}
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.caption}>{post.caption}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface2,
    marginBottom: 14,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginHorizontal: 18,
    borderWidth: 0.5,
    borderColor: theme.colors.line,
  },
  pinnedBar: {
    padding: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface2,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.line,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  inner: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authorName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 13,
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  menuBtn: {
    backgroundColor: theme.colors.accentTint,
    borderRadius: theme.radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  menuBtnText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.accent,
    letterSpacing: 0.8,
    fontFamily: theme.fonts.sans,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.ink2,
    fontStyle: 'italic',
    fontFamily: theme.fonts.serifItalic,
  },
  editWrap: { gap: 10 },
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  saveBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveText: { fontSize: 14, fontWeight: '600', color: theme.colors.bg, fontFamily: theme.fonts.sans },
});
