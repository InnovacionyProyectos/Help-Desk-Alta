export class PaginatedResultDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
