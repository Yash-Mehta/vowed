import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Avatar } from './Avatar';
import { OptionsSheet, SheetOption } from './OptionsSheet';
import { theme } from '../constants/theme';
import { GuestEntry } from '../lib/guestSections';
import { PartyRole, PARTY_ROLE_ORDER, PARTY_ROLE_LABELS } from '../lib/partyRoles';

interface Props {
  uid: string;
  // Already normalised by toEntry. Member docs are client-written and rules
  // constrain only role/partyRole/isCouple, so a raw doc could carry a
  // non-string displayName straight into Avatar's name.split(' ') and take
  // down the host's manage tab — the screen used to remove that guest.
  user: GuestEntry;
  currentUid?: string;
  onPromote?: (uid: string) => void;
  onDemote?: (uid: string) => void;
  onRemove?: (uid: string) => void;
  onChangePartyRole?: (uid: string, partyRole: PartyRole) => void;
}

export function GuestRow({
  uid,
  user,
  currentUid,
  onPromote,
  onDemote,
  onRemove,
  onChangePartyRole,
}: Props) {
  const isSelf = uid === currentUid;
  const [sheetOpen, setSheetOpen] = useState(false);
  const partyRole = user.partyRole;
  function confirmRemove() {
    Alert.alert(
      'Remove guest',
      `Remove ${user.name} from the guest list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove?.(uid) },
      ]
    );
  }

  function confirmPromote() {
    Alert.alert('Make host', `Give ${user.name} host access?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make host', onPress: () => onPromote?.(uid) },
    ]);
  }

  function confirmDemote() {
    Alert.alert('Remove host access', `Downgrade ${user.name} to guest?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Downgrade', style: 'destructive', onPress: () => onDemote?.(uid) },
    ]);
  }

  // One sheet rather than a row of buttons: Android caps Alert at three
  // buttons and silently drops the rest, and this is five roles plus Cancel.
  // Party roles apply immediately — they are cheap and reversible, so a
  // confirmation on each would just be noise. Granting or removing host access
  // keeps its confirmation, because that one changes what a person can do.
  const roleOptions: SheetOption[] = [
    ...PARTY_ROLE_ORDER.map((value) => ({
      label: PARTY_ROLE_LABELS[value],
      selected: value === partyRole,
      onPress: () => onChangePartyRole?.(uid, value),
    })),
    // Self is deliberately excluded here but NOT from the party roles above:
    // a host marking themselves as the couple is the most likely first use of
    // this control, while letting them drop their own host access is how you
    // lock yourself out of your own wedding.
    ...(!isSelf && user.role === 'host' && onDemote
      ? [{ label: 'Remove host access', destructive: true, onPress: confirmDemote }]
      : []),
    ...(!isSelf && user.role !== 'host' && onPromote
      ? [{ label: 'Make host', onPress: confirmPromote }]
      : []),
  ];

  return (
    <View style={styles.row}>
      <Avatar uri={user.photoURL} name={user.name} size={40} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.name}</Text>
          {user.role === 'host' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>HOST</Text>
            </View>
          )}
          {/* Deliberately a different register from the HOST badge above: that
              one is an authority signal, this one is only where someone sits in
              the wedding. If they read as the same axis, the distinction the
              whole feature rests on is lost at a glance. */}
          {partyRole !== 'guest' && (
            <View style={styles.partyBadge}>
              <Text style={styles.partyBadgeText}>{PARTY_ROLE_LABELS[partyRole]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.blurb} numberOfLines={1}>{user.blurb}</Text>
      </View>
      <View style={styles.actions}>
        {onChangePartyRole && (
          <TouchableOpacity
            style={styles.roleBtn}
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change role for ${user.name}`}
            activeOpacity={0.7}>
            <Text style={styles.roleBtnText}>Role</Text>
          </TouchableOpacity>
        )}
        {!isSelf && onRemove && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={confirmRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${user.name}`}
            activeOpacity={0.7}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mounted only while open: a guest list is a long list, and an unmounted
          Modal costs nothing per row. */}
      {sheetOpen && (
        <OptionsSheet
          visible
          options={roleOptions}
          onClose={() => setSheetOpen(false)}
        />
      )}
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
  partyBadge: {
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radii.pill,
  },
  partyBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: theme.colors.ink3,
    fontFamily: theme.fonts.sans,
  },
  blurb: { fontSize: 11, color: theme.colors.ink3, marginTop: 1, fontFamily: theme.fonts.sans },
  actions: { flexDirection: 'row', gap: 6 },
  roleBtn: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBtnText: { fontSize: 11, color: theme.colors.accent, fontWeight: '600', fontFamily: theme.fonts.sans },
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
