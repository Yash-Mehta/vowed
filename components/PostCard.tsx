import { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Avatar } from './Avatar';
import { theme } from '../constants/theme';

export interface Post {
  id: string;
  authorName: string;
  authorPhotoURL: string | null;
  type: 'photo' | 'announcement';
  photoURL: string | null;
  caption: string;
  likeCount: number;
  commentCount: number;
  createdAt: any;
  pinned?: boolean;
}

interface Props {
  post: Post;
  liked: boolean;
  onLike: () => void;
  onCommentPress: () => void;
  isHost?: boolean;
  onDelete?: () => void;
  onTogglePin?: () => void;
}

export function PostCard({ post, liked, onLike, onCommentPress, isHost, onDelete, onTogglePin }: Props) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const timeAgo = post.createdAt?.toDate ? formatAgo(post.createdAt.toDate()) : '';

  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  function handleLike() {
    if (!liked) {
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

  // Sync optimistic count back once Firestore updates
  useEffect(() => { setOptimisticCount(null); }, [post.likeCount]);

  return (
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
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Post options', undefined, [
                { text: post.pinned ? 'Unpin' : 'Pin to top', onPress: onTogglePin },
                { text: 'Delete post', style: 'destructive', onPress: onDelete },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            activeOpacity={0.7}
            style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>· · ·</Text>
          </TouchableOpacity>
        )}
      </View>
      {post.photoURL && (
        <Image source={{ uri: post.photoURL }} style={styles.photo} resizeMode="cover" />
      )}
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Animated.Text
            style={[styles.actionIcon, liked && styles.liked, { transform: [{ scale: heartScale }] }]}>
            ♥
          </Animated.Text>
          <Text style={styles.actionCount}>{optimisticCount ?? post.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>○</Text>
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  headerText: { marginLeft: 10, flex: 1 },
  authorName: {
    fontWeight: '600',
    fontSize: 14,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  timestamp: { fontSize: 12, color: theme.colors.ink3, marginTop: 1, fontFamily: theme.fonts.sans },
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
  photo: { width: '100%', aspectRatio: 4 / 3 },
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
});
