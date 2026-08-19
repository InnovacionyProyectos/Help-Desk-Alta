import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@shared/api/httpClient';

export interface Area {
  id: number;
  name: string;
}

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: () => httpClient.get<Area[]>('/areas').then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}
