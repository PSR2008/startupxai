export const badgeStates = ['VERIFIED', 'BLOCKED', 'INCONCLUSIVE', 'STALE', 'NOT_CONFIGURED'] as const;
export type BadgeState = typeof badgeStates[number];
export function badgeSvg(state: BadgeState) {
  const value = badgeStates.includes(state) ? state : 'NOT_CONFIGURED';
  const color = { VERIFIED: '#176b45', BLOCKED: '#a52b2b', INCONCLUSIVE: '#80600d', STALE: '#646464', NOT_CONFIGURED: '#646464' }[value];
  const text = value === 'VERIFIED' ? 'Verified — Release Policy Satisfied' : value.replaceAll('_', ' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="24" role="img" aria-label="LaunchGate: ${text}"><title>LaunchGate: ${text}</title><rect width="420" height="24" rx="4" fill="${color}"/><rect width="100" height="24" fill="#252525"/><g fill="#fff" font-family="Verdana,sans-serif" font-size="11" text-anchor="middle"><text x="50" y="16">LaunchGate</text><text x="260" y="16">${text}</text></g></svg>`;
}
