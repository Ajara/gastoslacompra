import { cookies } from "next/headers";
import { ApiError } from "./api-browser";

function serverBase() {
  return process.env.API_INTERNAL_URL || "http://127.0.0.1:8080";
}

export async function apiServer<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const headers = new Headers(init.headers);
  const cookie = jar.toString();
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(serverBase() + path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Error del servidor");
  }
  return data as T;
}

export type Me = {
  user: { id: string; email: string } | null;
  household: { id: string; name: string; invite_code: string } | null;
};

export async function getMe(): Promise<Me> {
  try {
    return await apiServer<Me>("/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { user: null, household: null };
    }
    throw error;
  }
}

export { ApiError };
