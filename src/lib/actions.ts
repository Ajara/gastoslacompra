"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiServer, ApiError } from "./api";

export async function createHouseholdAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  try {
    await apiServer("/households", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear" };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function joinHouseholdAction(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  try {
    await apiServer("/households/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo unir" };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction() {
  try {
    await apiServer("/auth/logout", { method: "POST", body: "{}" });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
  }
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.delete("lacompra_session");
  redirect("/login");
}

export async function updateProductCategoryAction(
  productId: string,
  category: string,
) {
  try {
    await apiServer(`/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ category }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
  revalidatePath(`/producto/${productId}`);
  return {};
}
