export const WEDDING = {
  coupleName: 'Yash & Vaani',
  coupleNameFull: 'Yash and Vaani',
  date: 'Saturday, December 5, 2026',
  shortDate: 'Dec 5, 2026',
  dateStamp: '12 · 05 · 26',
  venue: 'Hard Rock Hotel & Casino · Punta Cana',
  venueShort: 'Hard Rock · Punta Cana',
  location: 'Punta Cana, Dominican Republic',
  hashtag: '#YashLovesVaani',
  registryUrl: 'https://withjoy.com/yash-and-vaani/registry',
  inviteCode: 'OURDAY2026',
  weddingDate: new Date('2026-12-05T18:00:00-05:00'), // 6 PM EST
  firstEventDate: new Date('2026-12-02T00:00:00-05:00'),
};

export function getDaysUntilWedding(): number {
  const now = new Date();
  const diff = WEDDING.weddingDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getCountdownParts(): { days: number; hours: number; mins: number } {
  const diff = WEDDING.weddingDate.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, mins };
}
