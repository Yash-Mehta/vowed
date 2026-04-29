import { Svg, G, Path, Text as SvgText, TSpan, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../constants/theme';

interface Props {
  size?: number;
  color?: string;
}

export function MonogramLarge({ size = 180, color = theme.colors.accent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <Stop offset="50%" stopColor={color} stopOpacity={1} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="100" r="88" stroke={color} strokeWidth={0.8} fill="none" opacity={0.5} />
      <Circle cx="100" cy="100" r="82" stroke={color} strokeWidth={0.5} fill="none" opacity={0.35} />
      <G stroke={color} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.8}>
        <Path d="M30 100 Q 26 60, 60 32" />
        <Path d="M40 70 Q 35 70, 32 76 Q 38 78, 42 74 Z" fill={color} fillOpacity={0.55} />
        <Path d="M48 56 Q 42 56, 39 62 Q 45 64, 50 60 Z" fill={color} fillOpacity={0.55} />
        <Path d="M58 44 Q 52 44, 49 50 Q 55 52, 60 48 Z" fill={color} fillOpacity={0.55} />
        <Path d="M34 86 Q 28 84, 24 88 Q 30 92, 36 90 Z" fill={color} fillOpacity={0.55} />
        <Path d="M170 100 Q 174 60, 140 32" />
        <Path d="M160 70 Q 165 70, 168 76 Q 162 78, 158 74 Z" fill={color} fillOpacity={0.55} />
        <Path d="M152 56 Q 158 56, 161 62 Q 155 64, 150 60 Z" fill={color} fillOpacity={0.55} />
        <Path d="M142 44 Q 148 44, 151 50 Q 145 52, 140 48 Z" fill={color} fillOpacity={0.55} />
        <Path d="M166 86 Q 172 84, 176 88 Q 170 92, 164 90 Z" fill={color} fillOpacity={0.55} />
        <Path d="M70 168 Q 100 178, 130 168" />
        <Path d="M88 172 Q 86 168, 90 164" />
        <Path d="M112 172 Q 114 168, 110 164" />
        <Circle cx="100" cy="174" r="1.5" fill={color} />
      </G>
      <SvgText
        x="100"
        y="120"
        textAnchor="middle"
        fontFamily={theme.fonts.serifItalic}
        fontSize={68}
        fontStyle="italic"
        fontWeight="500"
        fill={color}
        {...({ letterSpacing: -2 } as any)}>
        Y
        <TSpan dx={-4} dy={-2} fontStyle="normal" fontSize={36} fill={color} fillOpacity={0.7}>&amp;</TSpan>
        <TSpan dx={-2}>V</TSpan>
      </SvgText>
    </Svg>
  );
}
