export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiBrowser<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch("/backend" + path, {
    credentials: "include",
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Error del servidor");
  }
  return data as T;
}
