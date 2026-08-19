import { httpClient } from '@shared/api/httpClient';
import { UserSummary } from '@shared/types/ticket';

export const usersApi = {
  listTechnicians: () =>
    httpClient.get<UserSummary[]>('/users/technicians').then((r) => r.data),
};
