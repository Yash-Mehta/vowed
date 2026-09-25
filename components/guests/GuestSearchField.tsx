import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function GuestSearchField({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Search guests"
        placeholderTextColor={theme.colors.ink4}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search guests"
        accessibilityHint="Filters the guest list by name"
        // iOS draws its own clear affordance; Android has none, hence the
        // button below.
        clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
        maxFontSizeMultiplier={1.6}
      />
      {Platform.OS !== 'ios' && value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChange('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          // The glyph is well under 44pt on its own.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.clear}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: theme.space.m,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  clear: { marginLeft: -36, paddingHorizontal: theme.space.m },
  clearText: { fontSize: 13, color: theme.colors.ink3 },
});
