import { useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES, Country } from '../constants/countries';
import { theme } from '../constants/theme';

interface Props {
  value: Country;
  onChange: (country: Country) => void;
}

export function CountryCodePicker({ value, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q)
    );
  }, [query]);

  function pick(country: Country) {
    onChange(country);
    setQuery('');
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} activeOpacity={0.75}>
        <Text style={styles.flag}>{value.flag}</Text>
        <Text style={styles.dialCode}>{value.dialCode}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8, maxHeight: '70%' }]}>
            <Text style={styles.title}>Choose a country</Text>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              placeholderTextColor={theme.colors.ink4}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.iso}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => pick(item)} activeOpacity={0.65}>
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowDialCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No matching countries.</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: theme.colors.card,
    marginRight: 8,
  },
  flag: { fontSize: 20, marginRight: 6 },
  dialCode: { fontSize: 16, color: theme.colors.ink, fontFamily: theme.fonts.sans },
  chevron: { fontSize: 12, color: theme.colors.ink4, marginLeft: 4 },
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 20,
    ...theme.shadows.s3,
  },
  title: { fontSize: 16, fontWeight: '600', color: theme.colors.ink, fontFamily: theme.fonts.sans, marginBottom: 12, textAlign: 'center' },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface2,
    fontFamily: theme.fonts.sans,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: 0.5,
    borderColor: theme.colors.line,
  },
  rowFlag: { fontSize: 20, marginRight: 12 },
  rowName: { flex: 1, fontSize: 15, color: theme.colors.ink, fontFamily: theme.fonts.sans },
  rowDialCode: { fontSize: 14, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  empty: { textAlign: 'center', color: theme.colors.ink4, fontFamily: theme.fonts.sans, paddingVertical: 24 },
});
