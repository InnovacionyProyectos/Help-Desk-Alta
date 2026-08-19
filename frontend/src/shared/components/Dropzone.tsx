import { DragEvent, useRef, useState } from 'react';
import { useSystemConfig } from '@shared/hooks/useSystemConfig';

interface DropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  multiple?: boolean;
}

// Valida tamaño/extensión en el cliente usando la misma configuración
// (`system_config`) que el backend aplica de forma autoritativa en
// AttachmentUploadGuard; esto es solo para dar feedback inmediato, el
// servidor siempre vuelve a validar.
export function Dropzone({ onFilesAccepted, multiple = true }: DropzoneProps) {
  const { data: config } = useSystemConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (files: File[]): File[] => {
    if (!config) return files;

    const maxBytes = config.maxAttachmentSizeMb * 1024 * 1024;
    const allowed = config.allowedExtensions.map((e) => e.toLowerCase());

    const valid: File[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!allowed.includes(ext)) {
        setError(`"${file.name}": extensión no permitida (.${ext})`);
        continue;
      }
      if (file.size > maxBytes) {
        setError(`"${file.name}" supera el tamaño máximo de ${config.maxAttachmentSizeMb}MB`);
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = validate(Array.from(fileList));
    if (files.length > 0) onFilesAccepted(files);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius)',
          padding: '20px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? '#eaf0fe' : 'var(--color-bg)',
          fontSize: 13,
          color: 'var(--color-text-muted)',
        }}
      >
        Arrastre archivos aquí o haga clic para seleccionar
        {config && (
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Máx. {config.maxAttachmentSizeMb}MB · {config.allowedExtensions.join(', ')}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="form-field__error" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
