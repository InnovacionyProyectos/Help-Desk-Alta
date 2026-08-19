import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth,
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, fullWidth ? 'btn--full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}
