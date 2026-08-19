import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CategoryNode,
  SubcategoryNode,
  TypificationNode,
  classificationAdminApi,
} from './api/classificationAdminApi';
import { ClassificationFormModal } from './ClassificationFormModal';
import { TICKET_PRIORITY_LABELS } from '@shared/types/ticket';
import { EmptyState } from '@shared/components/EmptyState';

type EditTarget =
  | { kind: 'category'; node?: CategoryNode; parentId?: number }
  | { kind: 'subcategory'; node?: SubcategoryNode; parentId?: number }
  | { kind: 'typification'; node?: TypificationNode; parentId?: number };

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className="badge"
      style={{ backgroundColor: isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export function ClassificationTree({ categories }: { categories: CategoryNode[] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedSub, setExpandedSub] = useState<Set<number>>(new Set());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const toggleCategoryActive = useMutation({
    mutationFn: (c: CategoryNode) => classificationAdminApi.updateCategory(c.id, { isActive: !c.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'classification'] }),
  });
  const toggleSubcategoryActive = useMutation({
    mutationFn: (s: SubcategoryNode) =>
      classificationAdminApi.updateSubcategory(s.id, { isActive: !s.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'classification'] }),
  });
  const toggleTypificationActive = useMutation({
    mutationFn: (t: TypificationNode) =>
      classificationAdminApi.updateTypification(t.id, { isActive: !t.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'classification'] }),
  });

  const toggleExpanded = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  if (categories.length === 0) {
    return <EmptyState title="Aún no hay categorías" description="Cree la primera con el botón de arriba." />;
  }

  return (
    <>
      {categories.map((category) => (
        <div className="tree-node" key={category.id}>
          <div className="tree-node__row">
            <div className="tree-node__label">
              <button
                type="button"
                className="link-btn"
                onClick={() => toggleExpanded(expanded, setExpanded, category.id)}
              >
                {expanded.has(category.id) ? '▾' : '▸'}
              </button>
              {category.name}
              <ActiveBadge isActive={category.isActive} />
              <span className="badge-muted">{category.subcategories.length} subcategorías</span>
            </div>
            <div className="tree-node__actions">
              <button className="link-btn" type="button" onClick={() => setEditTarget({ kind: 'category', node: category })}>
                Editar
              </button>
              <button
                className={`link-btn${category.isActive ? ' link-btn--danger' : ''}`}
                type="button"
                onClick={() => toggleCategoryActive.mutate(category)}
              >
                {category.isActive ? 'Desactivar' : 'Activar'}
              </button>
              <button
                className="link-btn"
                type="button"
                onClick={() => setEditTarget({ kind: 'subcategory', parentId: category.id })}
              >
                + Subcategoría
              </button>
            </div>
          </div>

          {expanded.has(category.id) && (
            <div className="tree-node__children">
              {category.subcategories.length === 0 && (
                <EmptyState title="Sin subcategorías" />
              )}
              {category.subcategories.map((sub) => (
                <div className="tree-node" key={sub.id}>
                  <div className="tree-node__row">
                    <div className="tree-node__label">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => toggleExpanded(expandedSub, setExpandedSub, sub.id)}
                      >
                        {expandedSub.has(sub.id) ? '▾' : '▸'}
                      </button>
                      {sub.name}
                      <ActiveBadge isActive={sub.isActive} />
                      <span className="badge-muted">{sub.typifications.length} tipificaciones</span>
                    </div>
                    <div className="tree-node__actions">
                      <button
                        className="link-btn"
                        type="button"
                        onClick={() => setEditTarget({ kind: 'subcategory', node: sub })}
                      >
                        Editar
                      </button>
                      <button
                        className={`link-btn${sub.isActive ? ' link-btn--danger' : ''}`}
                        type="button"
                        onClick={() => toggleSubcategoryActive.mutate(sub)}
                      >
                        {sub.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        className="link-btn"
                        type="button"
                        onClick={() => setEditTarget({ kind: 'typification', parentId: sub.id })}
                      >
                        + Tipificación
                      </button>
                    </div>
                  </div>

                  {expandedSub.has(sub.id) && (
                    <div className="tree-node__children">
                      {sub.typifications.length === 0 && <EmptyState title="Sin tipificaciones" />}
                      {sub.typifications.map((typ) => (
                        <div className="tree-node__row" key={typ.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: 6 }}>
                          <div className="tree-node__label">
                            {typ.name}
                            <ActiveBadge isActive={typ.isActive} />
                            <span className="badge-muted">{TICKET_PRIORITY_LABELS[typ.defaultPriority]}</span>
                            {typ.slaHours != null && <span className="badge-muted">SLA {typ.slaHours}h</span>}
                          </div>
                          <div className="tree-node__actions">
                            <button
                              className="link-btn"
                              type="button"
                              onClick={() => setEditTarget({ kind: 'typification', node: typ })}
                            >
                              Editar
                            </button>
                            <button
                              className={`link-btn${typ.isActive ? ' link-btn--danger' : ''}`}
                              type="button"
                              onClick={() => toggleTypificationActive.mutate(typ)}
                            >
                              {typ.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {editTarget && (
        <ClassificationFormModal
          kind={editTarget.kind}
          node={editTarget.node as any}
          parentId={editTarget.parentId}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
