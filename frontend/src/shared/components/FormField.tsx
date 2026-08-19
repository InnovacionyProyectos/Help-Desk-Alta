import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

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

// forwardRef es obligatorio aquí: react-hook-form's register() devuelve un
// `ref` que necesita llegar al <input> nativo. Sin forwardRef, React
// descarta ese ref en silencio (con un warning en consola) porque un
// componente de función normal no puede recibir refs — y sin ref,
// react-hook-form nunca lee el valor real del campo (queda `undefined`).
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <input ref={ref} id={inputId} className={`input ${className}`} {...rest} />
    </FieldWrapper>
  );
});

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <textarea ref={ref} id={inputId} className={`input ${className}`} rows={4} {...rest} />
    </FieldWrapper>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, id, className = '', children, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} htmlFor={inputId!} error={error} hint={hint}>
      <select ref={ref} id={inputId} className={`select ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
});
