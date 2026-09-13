import { useEffect, useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  uri: string | null;
  name: string;
  size?: number;
  ringed?: boolean;
}

export function Avatar({ uri, name, size = 40, ringed = false }: Props) {
  // A URL that fails to load used to render an empty circle — indistinguishable
  // from a styling bug, and silent. Avatars live at the fixed path
  // avatars/{uid}.jpg, so replacing one revokes the previous download token and
  // any stale copy of that URL starts returning 403. Falling back to initials
  // makes that degrade like "no photo set" instead of looking broken.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatar = uri && !failed ? (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
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
