import { create } from 'zustand';

export interface OnboardingDraft {
  // Step 1 (create-account) — email/password handled by Firebase, not stored here
  ownerName: string;

  // Step 2 (names)
  person1First: string;
  person2First: string;
  coupleName: string;
  coupleNameFull: string;
  monogramInitials: string;

  // Step 3 (date-venue)
  weddingDateISO: string;
  firstEventDateISO: string;
  dateStamp: string;
  shortDate: string;
  displayDate: string;
  venue: string;
  venueShort: string;
  location: string;
  registryUrl: string;

  // Step 4 (theme)
  accentHex: string;
  accentDeepHex: string;
  accentSoftHex: string;
  accentTintHex: string;

  // Step 5 (invite codes)
  guestInviteCode: string;
  hostInviteCode: string;
}

const DEFAULT: OnboardingDraft = {
  ownerName: '',
  person1First: '',
  person2First: '',
  coupleName: '',
  coupleNameFull: '',
  monogramInitials: '',
  weddingDateISO: '',
  firstEventDateISO: '',
  dateStamp: '',
  shortDate: '',
  displayDate: '',
  venue: '',
  venueShort: '',
  location: '',
  registryUrl: '',
  accentHex: '#7A4A3F',
  accentDeepHex: '#5C3329',
  accentSoftHex: '#C58A7A',
  accentTintHex: '#F1DFD6',
  guestInviteCode: '',
  hostInviteCode: '',
};

interface OnboardingState {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: DEFAULT,
  update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: () => set({ draft: DEFAULT }),
}));
