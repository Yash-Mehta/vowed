import { Image, View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  uri: string | null;
  name: string;
  size?: number;
  ringed?: boolean;
}

export function Avatar({ uri, name, size = 40, ringed = false }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatar = uri ? (
    <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
  ) : (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38, fontFamily: theme.fonts.serif }]}>
        {initials}
      </Text>
    </View>
  );

  if (!ringed) return avatar;

  return (
    <View style={{ borderRadius: 9999, padding: 3, borderWidth: 1, borderColor: theme.colors.accent }}>
      <View style={{ borderRadius: 9999, padding: 2, borderWidth: 2, borderColor: theme.colors.bg }}>
        {avatar}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: theme.colors.surface2 },
  placeholder: {
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: theme.colors.line,
  },
  initials: { color: theme.colors.accentDeep, fontWeight: '600' },
});
