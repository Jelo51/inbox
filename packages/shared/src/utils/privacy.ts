/**
 * Les journaux et les traces de consentement ne conservent jamais une adresse
 * IP complète : IPv4 tronquée au /24, IPv6 au /48.
 */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const cleaned = ip.trim().replace(/^::ffff:/i, '');

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (cleaned.includes(':')) {
    const groups = cleaned.split(':').filter((g) => g.length > 0);
    if (groups.length < 3) return null;
    return `${groups.slice(0, 3).join(':')}::`;
  }

  return null;
}

/** `flavien@example.com` → `f••••••n@example.com`, pour l'affichage en back-office. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '••••';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? '•'}••${domain}`;
  return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}${domain}`;
}
