import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@app/store/authStore';

export const httpClient = axios.create({ baseURL: '/api/v1' });

httpClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshInFlight: Promise<string> | null = null;

// Al recibir 401, intenta renovar el access token una sola vez (con las
// requests concurrentes esperando la misma promesa) antes de forzar logout.
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean });

    if (error.response?.status !== 401 || originalRequest?._retry) {
      if (error.response?.status === 401) useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    try {
      refreshInFlight ??= axios
        .post('/api/v1/auth/refresh', { refreshToken })
        .then(({ data }) => {
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
          return data.accessToken as string;
        })
        .finally(() => {
          refreshInFlight = null;
        });

      const newAccessToken = await refreshInFlight;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return httpClient(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    }
  },
);
