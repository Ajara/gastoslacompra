export type Category = "comida" | "bebida" | "limpieza" | "otros";

export type ExtractedLine = {
  quantity: number;
  name: string;
  unitPrice: number;
  amount: number;
  vatRate: number | null;
  note: string | null;
};

export type ExtractedTicket = {
  store: string;
  purchasedAt: string;
  total: number;
  paymentMethod: string | null;
  invoiceNumber: string | null;
  lines: ExtractedLine[];
};

export type DraftLine = {
  id: string;
  quantity: number;
  name: string;
  unitCents: number;
  amountCents: number;
  vatRate: number | null;
  note: string | null;
};

export type TicketDraft = {
  store: string;
  purchasedAt: string;
  totalCents: number;
  paymentMethod: string;
  invoiceNumber: string;
  lines: DraftLine[];
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
};

export type MemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string | null;
};

export type TicketRow = {
  id: string;
  household_id: string;
  created_by: string;
  store: string;
  purchased_at: string;
  total_cents: number;
  payment_method: string | null;
  invoice_number: string | null;
  photo_path: string | null;
  lines_sum_cents: number | null;
  mismatch: boolean;
  created_at: string;
};

export type TicketLineRow = {
  id: string;
  ticket_id: string;
  household_id: string;
  product_id: string | null;
  raw_name: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number;
  vat_rate: number | null;
  note: string | null;
};

export type ProductRow = {
  id: string;
  household_id: string;
  canonical_name: string;
  category: Category;
};
