import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  title: string;
  count: number;
  centred: boolean;
}

// Two registers, not one scaled: the couple's header is centred with a rule
// beneath it — the stationery treatment used on the party picker — while the
// rest are left-aligned with the rule running out to the count. The asymmetry
// is the point; it stops the page reading as four identical bands.
export function GuestSectionHeader({ title, count, centred }: Props) {
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;

  if (centred) {
    return (
      <View
        style={styles.centredWrap}
        accessibilityRole="header"
        accessibilityLabel={`${title}, ${people}`}>
        <Text style={styles.centredTitle} maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        <View style={styles.centredRule} accessible={false} />
      </View>
    );
  }

  return (
    <View
      style={styles.row}
      accessibilityRole="header"
      accessibilityLabel={`${title}, ${people}`}>
      <Text style={styles.rowTitle} maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
      <View style={styles.rowRule} accessible={false} />
      <Text style={styles.count} maxFontSizeMultiplier={1.4}>
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque: these headers stick, and a transparent one lets rows scroll
  // visibly through it. Easy to miss, because it looks fine until a section
  // is long enough to scroll under its own header.
  centredWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    paddingTop: theme.space.xxl,
    paddingBottom: theme.space.l,
  },
  centredTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
  },
  centredRule: {
    width: 72,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.colors.goldSoft,
    opacity: 0.7,
    marginTop: theme.space.m,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.m,
    backgroundColor: theme.colors.bg,
    paddingTop: theme.space.xxl,
    paddingBottom: theme.space.l,
  },
  rowTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
  },
  rowRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.goldSoft,
    opacity: 0.6,
  },
  count: {
    ...theme.type.caption,
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.ink4,
  },
});
