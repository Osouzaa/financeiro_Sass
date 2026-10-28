import type { UserDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { apiBlob } from '@/lib/api';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Busca a foto (rota autenticada, o <img> sozinho não manda o token) e devolve
 * uma data URL. A versão na chave faz a foto nova aparecer na hora em todo lugar.
 */
function useAvatarUrl(version: string | null): string | null {
  const { data } = useQuery({
    queryKey: ['avatar', version],
    queryFn: async () => blobToDataUrl(await apiBlob('/me/avatar')),
    enabled: Boolean(version),
    staleTime: Infinity,
  });
  return version ? (data ?? null) : null;
}

function initialsOf(name: string | undefined): string {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({
  user,
  size = 36,
  className = '',
}: {
  user: Pick<UserDto, 'name' | 'avatarVersion'> | null;
  size?: number;
  className?: string;
}) {
  const url = useAvatarUrl(user?.avatarVersion ?? null);
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ember font-display font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initialsOf(user?.name)}
    </span>
  );
}
