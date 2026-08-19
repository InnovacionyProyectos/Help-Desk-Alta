import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@shared/api/httpClient';

export interface SystemConfig {
  companyName: string;
  maxAttachmentSizeMb: number;
  allowedExtensions: string[];
  ticketPrefix: string;
}

export function useSystemConfig() {
  return useQuery({
    queryKey: ['system-config'],
    queryFn: () => httpClient.get<SystemConfig>('/system-config').then((r) => r.data),
    staleTime: 10 * 60_000, // cambia raramente; evita refetch en cada formulario
  });
}
