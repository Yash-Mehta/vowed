import { theme } from '../constants/theme';
import { useWeddingStore } from '../store/weddingStore';
import { hexWithAlpha } from '../utils/colorUtils';

export function useTheme() {
  const config = useWeddingStore((s) => s.config);
  if (!config) return theme;
  return {
    ...theme,
    colors: {
      ...theme.colors,
      accent: config.accentHex,
      accentDeep: config.accentDeepHex,
      accentSoft: config.accentSoftHex,
      accentTint: config.accentTintHex,
      countdownStart: config.accentDeepHex,
      countdownEnd: config.accentHex,
      line: hexWithAlpha(config.accentHex, 0.14),
      lineStrong: hexWithAlpha(config.accentHex, 0.22),
    },
  };
}
