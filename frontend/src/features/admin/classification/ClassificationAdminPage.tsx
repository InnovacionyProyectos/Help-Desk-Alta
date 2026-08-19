import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classificationAdminApi } from './api/classificationAdminApi';
import { ClassificationTree } from './ClassificationTree';
import { ClassificationFormModal } from './ClassificationFormModal';
import { Button } from '@shared/components/Button';
import { Spinner } from '@shared/components/Spinner';

export function ClassificationAdminPage() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin', 'classification'],
    queryFn: classificationAdminApi.getTree,
  });

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Clasificación de Tickets</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Categoría → Subcategoría → Tipificación. Los elementos inactivos no aparecen en el
            formulario de creación de tickets.
          </p>
        </div>
        <Button onClick={() => setIsCreatingCategory(true)}>+ Nueva categoría</Button>
      </div>

      <div className="card">
        {isLoading || !categories ? <Spinner /> : <ClassificationTree categories={categories} />}
      </div>

      {isCreatingCategory && (
        <ClassificationFormModal kind="category" onClose={() => setIsCreatingCategory(false)} />
      )}
    </>
  );
}
