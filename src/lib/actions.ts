"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractedToCents, SEED_TICKETS } from "./seed-data";
import { getMembership, insertExtractedTicket } from "./household";
import { isMismatch } from "./money";
import type { ExtractedTicket } from "./types";

export async function createHouseholdAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const { supabase, user } = await getMembership();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_household", { p_name: name });
  if (error) {
    return { error: mapRpcError(error.message) };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function joinHouseholdAction(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  const { supabase, user } = await getMembership();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("join_household", { p_code: code });
  if (error) {
    return { error: mapRpcError(error.message) };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction() {
  const { supabase } = await getMembership();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function saveTicketAction(input: {
  ticket: ExtractedTicket;
  totalCents: number;
  lines: Array<{
    name: string;
    quantity: number;
    unitCents: number;
    amountCents: number;
    vatRate: number | null;
    note: string | null;
  }>;
  photoPath?: string | null;
  ticketId?: string;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, household } = await getMembership();
  if (!user || !household) return { error: "No hay hucha" };

  const linesSumCents = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
  const mismatch = isMismatch(input.totalCents, linesSumCents);

  try {
    const id = await insertExtractedTicket({
      supabase,
      householdId: household.id,
      userId: user.id,
      ticket: { ...input.ticket, store: input.ticket.store.trim() },
      ticketId: input.ticketId,
      photoPath: input.photoPath ?? null,
      totalCents: input.totalCents,
      lines: input.lines,
      mismatch,
      linesSumCents,
    });
    revalidatePath("/");
    return { id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
}

export async function seedDemoTicketsAction(): Promise<{ error?: string }> {
  const { supabase, user, household } = await getMembership();
  if (!user || !household) return { error: "No hay hucha" };

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.id);

  if ((count ?? 0) > 0) {
    return { error: "La hucha ya tiene tickets" };
  }

  try {
    for (const ticket of SEED_TICKETS) {
      const cents = extractedToCents(ticket);
      await insertExtractedTicket({
        supabase,
        householdId: household.id,
        userId: user.id,
        ticket,
        photoPath: null,
        totalCents: cents.totalCents,
        lines: cents.lines,
        mismatch: isMismatch(cents.totalCents, cents.linesSumCents),
        linesSumCents: cents.linesSumCents,
      });
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cargar el ejemplo" };
  }

  revalidatePath("/");
  return {};
}

export async function updateProductCategoryAction(
  productId: string,
  category: string,
) {
  const { supabase, household } = await getMembership();
  if (!household) return { error: "No hay hucha" };

  const { error } = await supabase
    .from("products")
    .update({ category })
    .eq("id", productId)
    .eq("household_id", household.id);

  if (error) return { error: error.message };
  revalidatePath(`/producto/${productId}`);
  return {};
}

function mapRpcError(message: string): string {
  if (message.includes("already in a household")) {
    return "Ya perteneces a una hucha";
  }
  if (message.includes("invalid invite code")) {
    return "Ese código no existe";
  }
  if (message.includes("name too short")) {
    return "Ponle un nombre a la hucha";
  }
  return message;
}
