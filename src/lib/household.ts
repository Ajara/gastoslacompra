import { categorize, normalizeAlias } from "./categories";
import { createClient } from "./supabase/server";
import type { Category, ExtractedTicket, Household, MemberRow } from "./types";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getMembership() {
  const { supabase, user } = await getSessionUser();
  if (!user) return { supabase, user: null, member: null, household: null };

  const { data: member } = await supabase
    .from("members")
    .select("id, household_id, user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return { supabase, user, member: null, household: null };

  const { data: household } = await supabase
    .from("households")
    .select("id, name, invite_code")
    .eq("id", member.household_id)
    .single();

  return {
    supabase,
    user,
    member: member as MemberRow,
    household: household as Household | null,
  };
}

export async function matchOrCreateProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  rawName: string,
  category?: Category,
): Promise<string> {
  const alias = normalizeAlias(rawName);

  const { data: existing } = await supabase
    .from("product_aliases")
    .select("product_id")
    .eq("household_id", householdId)
    .eq("alias", alias)
    .maybeSingle();

  if (existing?.product_id) return existing.product_id as string;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      household_id: householdId,
      canonical_name: rawName.trim(),
      category: category ?? categorize(rawName),
    })
    .select("id")
    .single();

  if (productError || !product) {
    throw new Error(productError?.message || "No se pudo crear el producto");
  }

  const { error: aliasError } = await supabase.from("product_aliases").insert({
    product_id: product.id,
    household_id: householdId,
    alias,
  });

  if (aliasError && !aliasError.message.includes("duplicate")) {
    throw new Error(aliasError.message);
  }

  if (aliasError) {
    const { data: raced } = await supabase
      .from("product_aliases")
      .select("product_id")
      .eq("household_id", householdId)
      .eq("alias", alias)
      .single();
    if (raced?.product_id) return raced.product_id as string;
  }

  return product.id as string;
}

export async function insertExtractedTicket(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  householdId: string;
  userId: string;
  ticket: ExtractedTicket;
  ticketId?: string;
  photoPath?: string | null;
  totalCents: number;
  lines: Array<{
    name: string;
    quantity: number;
    unitCents: number;
    amountCents: number;
    vatRate: number | null;
    note: string | null;
  }>;
  mismatch: boolean;
  linesSumCents: number;
}): Promise<string> {
  const ticketId = options.ticketId ?? crypto.randomUUID();

  const { error: ticketError } = await options.supabase.from("tickets").insert({
    id: ticketId,
    household_id: options.householdId,
    created_by: options.userId,
    store: options.ticket.store,
    purchased_at: options.ticket.purchasedAt,
    total_cents: options.totalCents,
    payment_method: options.ticket.paymentMethod,
    invoice_number: options.ticket.invoiceNumber,
    photo_path: options.photoPath ?? null,
    lines_sum_cents: options.linesSumCents,
    mismatch: options.mismatch,
  });

  if (ticketError) throw new Error(ticketError.message);

  for (const line of options.lines) {
    const productId = await matchOrCreateProduct(
      options.supabase,
      options.householdId,
      line.name,
    );

    const { error: lineError } = await options.supabase.from("ticket_lines").insert({
      ticket_id: ticketId,
      household_id: options.householdId,
      product_id: productId,
      raw_name: line.name,
      quantity: line.quantity,
      unit_cents: line.unitCents,
      amount_cents: line.amountCents,
      vat_rate: line.vatRate,
      note: line.note,
    });

    if (lineError) throw new Error(lineError.message);
  }

  return ticketId;
}
