// Invite sharing lives here so the copy and the URL shape stay in one place.
//
// The share sheet used to send the bare code string — a guest received a text
// reading "G-4B2X" with no app name, no link and no instructions, at the single
// highest-intent moment in the product. This builds a message that explains
// itself and a link that does the work.

// Web link rather than the vowed:// scheme directly: a scheme link is dead text
// to anyone who doesn't have the app yet, which is most of a guest list. This
// page bounces straight into the app when it is installed and offers the store
// otherwise, and it survives being pasted anywhere.
const JOIN_URL = 'https://vowedsocial.com/join';

export type InviteKind = 'guest' | 'host';

export function joinLink(code: string): string {
  return `${JOIN_URL}?code=${encodeURIComponent(code)}`;
}

export function inviteMessage(kind: InviteKind, code: string, coupleName?: string | null): string {
  const couple = coupleName?.trim();
  const link = joinLink(code);

  if (kind === 'host') {
    // Host codes grant admin rights, so the copy has to say so — a forwarded
    // host code is indistinguishable from an intended one.
    return [
      couple
        ? `You've been given host access to ${couple}'s wedding on Vowed.`
        : `You've been given host access to a wedding on Vowed.`,
      '',
      `Open: ${link}`,
      `Or enter the code: ${code}`,
      '',
      'Host access lets you post announcements, manage the schedule and manage guests — please don’t forward it.',
    ].join('\n');
  }

  return [
    couple
      ? `${couple} are sharing their wedding photos on Vowed — join us.`
      : 'Join our wedding on Vowed to see and share photos.',
    '',
    `Join here: ${link}`,
    `Or enter the code: ${code}`,
  ].join('\n');
}
