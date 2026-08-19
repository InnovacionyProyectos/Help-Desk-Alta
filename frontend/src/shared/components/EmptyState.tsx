interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, margin: 0 }}>{title}</p>
      {description && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{description}</p>}
    </div>
  );
}
