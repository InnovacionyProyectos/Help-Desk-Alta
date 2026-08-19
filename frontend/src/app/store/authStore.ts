import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RoleCode = 'ADMIN' | 'TECHNICIAN' | 'END_USER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

// persist guarda la sesión en localStorage; los tokens en sí siguen
// expirando según JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN del backend.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'helpdesk-auth' },
  ),
);
