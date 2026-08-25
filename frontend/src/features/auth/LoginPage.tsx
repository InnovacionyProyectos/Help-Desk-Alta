import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { authApi } from './api/authApi';
import { useAuthStore } from '@app/store/authStore';
import { TextField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const { accessToken, refreshToken, user } = await authApi.login(values.email, values.password);
      setSession(user, accessToken, refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError('Correo o contraseña incorrectos');
      } else if (isAxiosError(error) && error.response?.status === 403) {
        setServerError(String(error.response.data?.message ?? 'Acceso denegado'));
      } else {
        setServerError('No se pudo iniciar sesión. Intente nuevamente.');
      }
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__brand-mark">alta</span>
          <span className="auth-card__brand-sub">Help Desk</span>
        </div>
        <p className="auth-card__subtitle">Ingrese con su correo corporativo</p>

        {serverError && <div className="auth-error">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            Iniciar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
