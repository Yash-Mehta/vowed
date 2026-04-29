import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { Post } from './PostCard';
import { theme } from '../constants/theme';

interface Props {
  post: Post;
}

export function AnnouncementCard({ post }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar uri={post.authorPhotoURL} name={post.authorName} size={32} />
        <Text style={styles.authorName}>{post.authorName}</Text>
      </View>
      <Text style={styles.caption}>{post.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface2,
    marginBottom: 14,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginHorizontal: 18,
    borderWidth: 0.5,
    borderColor: theme.colors.line,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authorName: {
    fontWeight: '600',
    fontSize: 13,
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.ink2,
    fontStyle: 'italic',
    fontFamily: theme.fonts.serifItalic,
  },
});
