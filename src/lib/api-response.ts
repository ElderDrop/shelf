export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: string;
  details?: ApiErrorDetail[];
}

export interface ApiSuccessBody<T> {
  data: T;
}

export function jsonError(status: number, error: string, details?: ApiErrorDetail[]): Response {
  const body: ApiErrorBody = details?.length ? { error, details } : { error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown, status = 200): Response {
  const body: ApiSuccessBody<unknown> = { data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
