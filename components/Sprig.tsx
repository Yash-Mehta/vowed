import { Svg, G, Path, Ellipse } from 'react-native-svg';
import { theme } from '../constants/theme';

interface Props {
  size?: number;
  color?: string;
  flip?: boolean;
}

export function Sprig({ size = 36, color = theme.colors.leaf, flip = false }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M30 4C24 12 20 22 20 34" stroke={color} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <G fill={color}>
        <Ellipse cx={21} cy={10} rx={6.5} ry={2.6} rotation={-40} originX={21} originY={10} />
        <Ellipse cx={15} cy={18} rx={7} ry={2.8} rotation={-32} originX={15} originY={18} />
        <Ellipse cx={12} cy={27} rx={7.4} ry={3} rotation={-18} originX={12} originY={27} />
        <Ellipse cx={13} cy={36} rx={6.6} ry={2.7} rotation={-4} originX={13} originY={36} />
      </G>
    </Svg>
  );
}
