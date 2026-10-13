/** The API's standard paginated response envelope. */
export interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
