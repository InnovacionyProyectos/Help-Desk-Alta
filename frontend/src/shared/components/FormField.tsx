import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, htmlFor, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="form-field__error">{error}</span> : hint ? (
        <span className="form-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...rest }: TextFieldProps) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <input id={inputId} className={`input ${className}`} {...rest} />
    </FieldWrapper>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, id, className = '', ...rest }: TextAreaFieldProps) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <textarea id={inputId} className={`input ${className}`} rows={4} {...rest} />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, id, className = '', children, ...rest }: SelectFieldProps) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <select id={inputId} className={`select ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}
