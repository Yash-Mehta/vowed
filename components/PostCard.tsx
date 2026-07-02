import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Timestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { OptionsSheet } from './OptionsSheet';
import { theme } from '../constants/theme';

export interface Post {
  id: string;
  authorName: string;
  authorPhotoURL: string | null;
  type: 'photo' | 'announcement';
  photoURL: string | null;
  photoURLs?: string[];
  caption: string;
  likeCount: number;
  commentCount: number;
  createdAt: Timestamp | null;
  pinned?: boolean;
}

interface Props {
  post: Post;
  liked: boolean;
  onLike: () => void;
  onLikeCountPress?: () => void;
  onCommentPress: () => void;
  isHost?: boolean;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onEdit?: (newCaption: string) => void;
  onDownload?: (url: string) => void;
}

export function PostCard({ post, liked, onLike, onLikeCountPress, onCommentPress, isHost, onDelete, onTogglePin, onEdit, onDownload }: Props) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const timeAgo = post.createdAt?.toDate ? formatAgo(post.createdAt.toDate()) : '';
  const { width: windowWidth } = useWindowDimensions();
  // Card spans the screen minus the 18px feed margins on each side
  const photoWidth = windowWidth - 36;

  const photos = post.photoURLs?.length ? post.photoURLs : post.photoURL ? [post.photoURL] : [];
  const [photoIndex, setPhotoIndex] = useState(0);

  function handlePhotoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / photoWidth);
    setPhotoIndex(Math.min(Math.max(index, 0), photos.length - 1));
  }

  const [localLiked, setLocalLiked] = useState(liked);
  const hasInteracted = useRef(false);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  function handleLike() {
    hasInteracted.current = true;
    const willLike = !localLiked;
    setLocalLiked(willLike);
    if (willLike) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.4, duration: 130, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1.0, duration: 80, useNativeDriver: true }),
      ]).start();
      setOptimisticCount((post.likeCount ?? 0) + 1);
    } else {
      Haptics.selectionAsync();
      setOptimisticCount(Math.max(0, (post.likeCount ?? 0) - 1));
    }
    onLike();
  }

  // Sync liked from parent only until the user has interacted (handles initial Firestore load
  // without letting onSnapshot reverts flip the heart back after an optimistic toggle)
  useEffect(() => {
    if (!hasInteracted.current) setLocalLiked(liked);
  }, [liked]);

  // Sync optimistic count back once Firestore updates
  useEffect(() => { setOptimisticCount(null); }, [post.likeCount]);

  return (
    <>
    <View style={[styles.card, theme.shadows.s1]}>
      {post.pinned && (
        <View style={styles.pinnedBar}>
          <Text style={styles.pinnedText}>✦  Pinned</Text>
        </View>
      )}
      <View style={styles.header}>
        <Avatar uri={post.authorPhotoURL} name={post.authorName} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Text style={styles.timestamp}>{timeAgo}</Text>
        </View>
        {isHost && onDelete && (
          <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.7} style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>· · ·</Text>
          </TouchableOpacity>
        )}
      </View>
      {photos.length > 0 && (
        <View style={styles.photoContainer}>
          {photos.length === 1 ? (
            <Image source={{ uri: photos[0] }} style={styles.photo} resizeMode="cover" />
          ) : (
            <>
              <FlatList
                data={photos}
                keyExtractor={(url) => url}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handlePhotoScroll}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={[styles.photo, { width: photoWidth }]}
                    resizeMode="cover"
                  />
                )}
              />
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {photoIndex + 1}/{photos.length}
                </Text>
              </View>
              <View style={styles.dots}>
                {photos.map((url, i) => (
                  <View key={url} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                ))}
              </View>
            </>
          )}
          {isHost && onDownload && (
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => onDownload(photos[photoIndex])}
              activeOpacity={0.75}>
              <Ionicons name="download-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
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
      ) : post.caption ? (
        <Text style={styles.caption}>{post.caption}</Text>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.action}>
          <TouchableOpacity onPress={handleLike}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={localLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={localLiked ? theme.colors.heart : theme.colors.ink4}
              />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onLikeCountPress}
            disabled={!onLikeCountPress || (optimisticCount ?? post.likeCount) === 0}>
            <Text style={styles.actionCount}>{optimisticCount ?? post.likeCount}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.action} onPress={onCommentPress}>
          <Ionicons name="chatbubble-outline" size={18} color={theme.colors.ink4} />
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
    {isHost && onDelete && (
      <OptionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        options={[
          { label: post.pinned ? 'Unpin' : 'Pin to top', onPress: onTogglePin },
          { label: 'Edit caption', onPress: () => setEditing(true) },
          { label: 'Delete post', onPress: onDelete, destructive: true },
        ]}
      />
    )}
    </>
  );
}

function formatAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
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
    backgroundColor: theme.colors.goldTint,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.line,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.gold,
    fontFamily: theme.fonts.sans,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  headerText: { marginLeft: 10, flex: 1 },
  authorName: {
    fontSize: 16,
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
  },
  timestamp: {
    fontSize: 10,
    color: theme.colors.ink3,
    marginTop: 1,
    fontFamily: theme.fonts.sans,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hostBadge: {
    backgroundColor: theme.colors.accentTint,
    borderRadius: theme.radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hostBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.accent,
    letterSpacing: 0.8,
    fontFamily: theme.fonts.sans,
  },
  photoContainer: { width: '100%', aspectRatio: 4 / 3 },
  photo: { width: '100%', height: '100%' },
  photoCounter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCounterText: { color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: theme.fonts.sans },
  dots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#fff' },
  downloadBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  caption: {
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 18, color: theme.colors.ink4 },
  liked: { color: theme.colors.heart },
  actionCount: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  editWrap: { paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
    minHeight: 70,
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
