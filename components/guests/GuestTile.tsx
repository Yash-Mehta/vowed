import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from '../Avatar';
import { TileVariant } from '../../lib/guestSections';
import { theme } from '../../constants/theme';

interface Props {
  uid: string;
  name: string;
  photoURL: string | null;
  blurb: string;
  isSingle: boolean;
  variant: TileVariant;
  width: number;
  sectionTitle: string;
  onSelect: (uid: string) => void;
}

const AVATAR_SIZE: Record<TileVariant, number> = { large: 96, medium: 64, compact: 52 };
const BADGE_SIZE: Record<TileVariant, number> = { large: 22, medium: 20, compact: 18 };

function GuestTileBase({
  uid,
  name,
  photoURL,
  blurb,
  isSingle,
  variant,
  width,
  sectionTitle,
  onSelect,
}: Props) {
  const isCouple = variant === 'large';
  // The badge sits on the tile's own surface, so its ring has to match that
  // surface rather than always being white — the previous implementation
  // hardcoded the card colour, which only looked right while every tile was a
  // white card.
  const surface = isCouple ? theme.colors.surfaceRaised : theme.colors.bg;

  return (
    <TouchableOpacity
      style={[styles.tile, { width }, isCouple && styles.coupleTile]}
      onPress={() => onSelect(uid)}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${sectionTitle}.${isSingle ? ' Single.' : ''}${blurb ? ` ${blurb}` : ''}`}
      accessibilityHint="Opens their profile"
      activeOpacity={0.8}>
      {/* Inset gold hairline, matching the countdown card on the feed, so the
          couple reads as the same stationery system rather than a bigger card. */}
      {isCouple && <View style={styles.coupleFrame} pointerEvents="none" />}

      <View>
        <Avatar uri={photoURL} name={name} size={AVATAR_SIZE[variant]} ringed={isCouple} />
        {isSingle && (
          <View
            style={[
              styles.singleBadge,
              {
                width: BADGE_SIZE[variant],
                height: BADGE_SIZE[variant],
                borderRadius: BADGE_SIZE[variant] / 2,
                borderColor: surface,
              },
            ]}
            // "Single" is already in the tile's label above; without this,
            // VoiceOver reads a bare letter "S" after every name.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Text style={styles.singleBadgeText}>S</Text>
          </View>
        )}
      </View>

      <Text
        style={[styles.name, isCouple ? styles.coupleName : styles[`${variant}Name`]]}
        numberOfLines={variant === 'compact' ? 2 : 1}
        // The couple's names are the content of this screen, so they scale
        // freely; the smaller registers are decorative enough to cap.
        maxFontSizeMultiplier={isCouple ? undefined : 1.6}>
        {name}
      </Text>

      {variant !== 'compact' && blurb ? (
        <Text
          style={[styles.blurb, isCouple && styles.coupleBlurb]}
          numberOfLines={isCouple ? 2 : 1}
          maxFontSizeMultiplier={1.6}>
          {blurb}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// Primitive props only, deliberately: every onSnapshot delivers a fresh array
// of fresh objects even when nothing changed, so passing the member object
// would make this memo a permanent miss and re-render all 150 tiles on any
// edit anywhere.
export const GuestTile = memo(GuestTileBase);

const styles = StyleSheet.create({
  tile: { alignItems: 'center' },

  // The couple is the only section that is a card at all. Shrinking a card
  // just yields a smaller card; removing it is what makes the hierarchy drop.
  coupleTile: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.space.xl,
    paddingHorizontal: theme.space.m,
    ...theme.shadows.s2,
  },
  coupleFrame: {
    ...StyleSheet.absoluteFillObject,
    margin: 5,
    borderRadius: theme.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.goldSoft,
    opacity: 0.55,
  },

  name: { textAlign: 'center', color: theme.colors.ink, marginTop: theme.space.s },
  coupleName: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    marginTop: theme.space.m,
  },
  mediumName: { fontSize: 13, fontWeight: '600', fontFamily: theme.fonts.sans },
  largeName: { ...theme.type.title, fontFamily: theme.fonts.serif },
  compactName: {
    ...theme.type.caption,
    color: theme.colors.ink2,
    fontFamily: theme.fonts.sans,
    marginTop: theme.space.xs,
  },

  blurb: {
    ...theme.type.caption,
    color: theme.colors.ink3,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: theme.fonts.sans,
  },
  coupleBlurb: {
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.ink2,
    marginTop: theme.space.xs,
  },

  singleBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  singleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.bg,
    fontFamily: theme.fonts.sans,
  },
});
