import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Avatar } from './Avatar';
import { theme } from '../constants/theme';
import { UserDoc } from '../lib/firestore';

interface Props {
  uid: string;
  user: UserDoc;
  onPromote?: (uid: string) => void;
  onDemote?: (uid: string) => void;
  onRemove?: (uid: string) => void;
}

export function GuestRow({ uid, user, onPromote, onDemote, onRemove }: Props) {
  function confirmRemove() {
    Alert.alert(
      'Remove guest',
      `Remove ${user.displayName} from the guest list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove?.(uid) },
      ]
    );
  }

  function confirmPromote() {
    Alert.alert('Make host', `Give ${user.displayName} host access?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make host', onPress: () => onPromote?.(uid) },
    ]);
  }

  function confirmDemote() {
    Alert.alert('Remove host access', `Downgrade ${user.displayName} to guest?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Downgrade', style: 'destructive', onPress: () => onDemote?.(uid) },
    ]);
  }

  return (
    <View style={styles.row}>
      <Avatar uri={user.photoURL} name={user.displayName} size={40} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.displayName}</Text>
          {user.role === 'host' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>HOST</Text>
            </View>
          )}
        </View>
        <Text style={styles.blurb} numberOfLines={1}>{user.howTheyKnow}</Text>
      </View>
      <View style={styles.actions}>
        {user.role === 'host' && onDemote && (
          <TouchableOpacity style={styles.demoteBtn} onPress={confirmDemote} activeOpacity={0.7}>
            <Text style={styles.demoteBtnText}>Guest</Text>
          </TouchableOpacity>
        )}
        {user.role !== 'host' && onPromote && (
          <TouchableOpacity style={styles.promoteBtn} onPress={confirmPromote} activeOpacity={0.7}>
            <Text style={styles.promoteBtnText}>Host</Text>
          </TouchableOpacity>
        )}
        {onRemove && (
          <TouchableOpacity style={styles.removeBtn} onPress={confirmRemove} activeOpacity={0.7}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.line,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '600', color: theme.colors.ink, fontFamily: theme.fonts.sans },
  badge: {
    backgroundColor: theme.colors.accentTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radii.pill,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.sans,
  },
  blurb: { fontSize: 11, color: theme.colors.ink3, marginTop: 1, fontFamily: theme.fonts.sans },
  actions: { flexDirection: 'row', gap: 6 },
  promoteBtn: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoteBtnText: { fontSize: 11, color: theme.colors.accent, fontWeight: '600', fontFamily: theme.fonts.sans },
  demoteBtn: {
    borderWidth: 1,
    borderColor: theme.colors.ink3,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  demoteBtnText: { fontSize: 11, color: theme.colors.ink3, fontWeight: '600', fontFamily: theme.fonts.sans },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { fontSize: 12, color: theme.colors.ink3 },
});
