import { Laptop, Monitor, Smartphone, Tablet, type LucideIcon } from 'lucide-react';

/** Descrição amigável do navegador e sistema a partir do User-Agent. */
export function describeDevice(userAgent: string | null): { label: string; icon: LucideIcon } {
  if (!userAgent) return { label: 'Dispositivo desconhecido', icon: Monitor };
  const ua = userAgent;

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';

  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'sistema desconhecido';

  const icon = /iPad|Tablet/.test(ua)
    ? Tablet
    : /Mobi|Android|iPhone/.test(ua)
      ? Smartphone
      : /Macintosh|Windows/.test(ua)
        ? Laptop
        : Monitor;

  return { label: `${browser} no ${os}`, icon };
}
