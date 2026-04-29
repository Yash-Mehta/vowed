export function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface WeddingPalette {
  name: string;
  accent: string;
  deep: string;
  soft: string;
  tint: string;
}

export const WEDDING_PALETTES: WeddingPalette[] = [
  { name: 'Burgundy',    accent: '#7A4A3F', deep: '#5C3329', soft: '#C58A7A', tint: '#F1DFD6' },
  { name: 'Blush',       accent: '#C4796A', deep: '#A05A4C', soft: '#DFA99E', tint: '#FAEAE7' },
  { name: 'Sage',        accent: '#5A7A5A', deep: '#3D5C3D', soft: '#91AF91', tint: '#E0EDE0' },
  { name: 'Navy',        accent: '#2E4A6B', deep: '#1A2E45', soft: '#6E8FAF', tint: '#DCE8F5' },
  { name: 'Dusty Rose',  accent: '#B07A8A', deep: '#8C5A6A', soft: '#CFA9B4', tint: '#F5E8EC' },
  { name: 'Champagne',   accent: '#9C8060', deep: '#7A5E40', soft: '#C4A882', tint: '#F5EEE2' },
  { name: 'Slate',       accent: '#607A8C', deep: '#40607A', soft: '#90AABC', tint: '#E0ECF5' },
  { name: 'Terracotta',  accent: '#9C5A3A', deep: '#7A3C1E', soft: '#C48A6A', tint: '#F5E0D0' },
];
