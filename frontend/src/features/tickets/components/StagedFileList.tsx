function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StagedFileListProps {
  files: File[];
  onRemove: (index: number) => void;
}

// Lista de archivos aún no subidos (en el formulario de creación de ticket
// o antes de publicar un comentario), con opción de quitarlos.
export function StagedFileList({ files, onRemove }: StagedFileListProps) {
  if (files.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {files.map((file, index) => (
        <li
          key={`${file.name}-${index}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            padding: '6px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span>
            📎 {file.name} <span style={{ color: 'var(--color-text-muted)' }}>({formatSize(file.size)})</span>
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 12 }}
          >
            Quitar
          </button>
        </li>
      ))}
    </ul>
  );
}
