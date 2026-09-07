import { useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  length?: number;
  autoFocus?: boolean;
}

// A single real TextInput (invisible, absolutely positioned over the boxes)
// captures actual input and SMS autofill; the boxes below it are purely
// decorative, driven off the same value. Keeping one real input — rather
// than one per digit — is what lets textContentType="oneTimeCode" autofill
// work at all.
export function OtpCodeInput({ value, onChangeText, length = 6, autoFocus }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.wrap}>
      <View style={styles.boxRow} pointerEvents="none">
        {digits.map((d, i) => (
          <View
            key={i}
            style={[styles.box, i === activeIndex && value.length < length && styles.boxActive]}>
            <Text style={styles.digit}>{d}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        maxLength={length}
        caretHidden
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 12 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between' },
  box: {
    width: 46,
    height: 56,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.surface2,
  },
  boxActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.card },
  digit: { fontSize: 22, fontWeight: '600', color: theme.colors.ink, fontFamily: theme.fonts.sans },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
