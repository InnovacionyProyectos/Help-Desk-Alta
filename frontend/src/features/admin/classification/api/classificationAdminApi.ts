import { httpClient } from '@shared/api/httpClient';
import { TicketPriority } from '@shared/types/ticket';

interface ClassificationNodeBase {
  id: number;
  name: string;
  code?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface TypificationNode extends ClassificationNodeBase {
  defaultPriority: TicketPriority;
}

export interface SubcategoryNode extends ClassificationNodeBase {
  typifications: TypificationNode[];
}

export interface CategoryNode extends ClassificationNodeBase {
  subcategories: SubcategoryNode[];
}

export interface ClassificationNodePayload {
  name: string;
  code?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface TypificationPayload extends ClassificationNodePayload {
  subcategoryId?: number;
  defaultPriority?: TicketPriority;
}

export const classificationAdminApi = {
  getTree: () => httpClient.get<CategoryNode[]>('/classification/admin-tree').then((r) => r.data),

  createCategory: (payload: ClassificationNodePayload) =>
    httpClient.post('/classification/categories', payload).then((r) => r.data),
  updateCategory: (id: number, payload: Partial<ClassificationNodePayload>) =>
    httpClient.patch(`/classification/categories/${id}`, payload).then((r) => r.data),

  createSubcategory: (payload: ClassificationNodePayload & { categoryId: number }) =>
    httpClient.post('/classification/subcategories', payload).then((r) => r.data),
  updateSubcategory: (id: number, payload: Partial<ClassificationNodePayload & { categoryId: number }>) =>
    httpClient.patch(`/classification/subcategories/${id}`, payload).then((r) => r.data),

  createTypification: (payload: TypificationPayload & { subcategoryId: number }) =>
    httpClient.post('/classification/typifications', payload).then((r) => r.data),
  updateTypification: (id: number, payload: TypificationPayload) =>
    httpClient.patch(`/classification/typifications/${id}`, payload).then((r) => r.data),
};
