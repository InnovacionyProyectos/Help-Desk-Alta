import { httpClient } from '@shared/api/httpClient';
import { AuthUser } from '@app/store/authStore';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    httpClient.post<LoginResponse>('/auth/login', { email, password }).then((res) => res.data),

  logout: (refreshToken: string) => httpClient.post('/auth/logout', { refreshToken }),
};
