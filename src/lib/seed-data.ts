import { eurosToCents } from "./money";
import type { ExtractedTicket } from "./types";

type SeedLine = {
  quantity: number;
  name: string;
  unitPrice: number;
  amount: number;
  note?: string;
};

function ticket(
  store: string,
  purchasedAt: string,
  total: number,
  paymentMethod: string,
  invoiceNumber: string,
  lines: SeedLine[],
): ExtractedTicket {
  return {
    store,
    purchasedAt,
    total,
    paymentMethod,
    invoiceNumber,
    lines: lines.map((line) => ({
      quantity: line.quantity,
      name: line.name,
      unitPrice: line.unitPrice,
      amount: line.amount,
      vatRate: null,
      note: line.note ?? null,
    })),
  };
}

export const SEED_TICKETS: ExtractedTicket[] = [
  ticket(
    "GRUPO DIA",
    "2026-08-22T12:07:00.000Z",
    2.69,
    "TARJET.TEF",
    "1608903-00130961",
    [
      {
        quantity: 1,
        name: "MINI BOMBÓN CHERRY",
        unitPrice: 2.69,
        amount: 2.69,
      },
    ],
  ),
  ticket(
    "MERCADONA, S.A.",
    "2026-08-22T08:08:00.000Z",
    76.12,
    "TARJETA BANCARIA",
    "3452-017-271075",
    [
      { quantity: 1, name: "LECHE DESN P6", unitPrice: 4.92, amount: 4.92 },
      { quantity: 1, name: "SUAVIZANTE FLORAL", unitPrice: 1.8, amount: 1.8 },
      { quantity: 1, name: "PATATAS GAJO", unitPrice: 1.65, amount: 1.65 },
      { quantity: 1, name: "PATATA PREFREG. FINA", unitPrice: 1.85, amount: 1.85 },
      { quantity: 1, name: "NUEZ CASCARA NATURAL", unitPrice: 3.7, amount: 3.7 },
      { quantity: 1, name: "PIZZA JAMON Y QUESO", unitPrice: 2.5, amount: 2.5 },
      { quantity: 1, name: "PIZZA JYQ S/LACT/GLU", unitPrice: 3.2, amount: 3.2 },
      { quantity: 1, name: "CUARTO TRASERO CONG", unitPrice: 5.7, amount: 5.7 },
      { quantity: 1, name: "Q. LONCHAS CREMOSO", unitPrice: 2.8, amount: 2.8 },
      { quantity: 1, name: "GEL CON LEJIA", unitPrice: 1.9, amount: 1.9 },
      { quantity: 1, name: "ICE TEA MARACUYA", unitPrice: 0.5, amount: 0.5 },
      { quantity: 1, name: "PAN H BRIOCHE", unitPrice: 1.1, amount: 1.1 },
      { quantity: 2, name: "PAN M.CEREALES S/GLU", unitPrice: 2.74, amount: 5.48 },
      { quantity: 1, name: "Q RALLADO FUNDIR", unitPrice: 1.9, amount: 1.9 },
      { quantity: 2, name: "BATIDO CHOCOLATE PAC", unitPrice: 1.55, amount: 3.1 },
      { quantity: 1, name: "BOTE CHICLE ORIGINAL", unitPrice: 1.95, amount: 1.95 },
      { quantity: 1, name: "SURTIDO CROISSANTS", unitPrice: 2.55, amount: 2.55 },
      { quantity: 1, name: "24 HUEVOS FRESCOS", unitPrice: 5.25, amount: 5.25 },
      { quantity: 1, name: "NARANJA ZERO P6", unitPrice: 2.22, amount: 2.22 },
      { quantity: 1, name: "DETERGENTE FRESCURA", unitPrice: 3.5, amount: 3.5 },
      { quantity: 1, name: "MEJ. CHILE ESCABECHE", unitPrice: 2.65, amount: 2.65 },
      { quantity: 2, name: "C. SIN GLUTEN LATA", unitPrice: 0.48, amount: 0.96 },
      { quantity: 1, name: "BARRA DE PAN", unitPrice: 0.5, amount: 0.5 },
      { quantity: 2, name: "LIMON ZERO LATA", unitPrice: 0.37, amount: 0.74 },
      { quantity: 4, name: "COCA COLA ZERO ZERO", unitPrice: 0.95, amount: 3.8 },
      { quantity: 1, name: "LA CIGALA SABOR", unitPrice: 2.45, amount: 2.45 },
      { quantity: 1, name: "HIGIENICO DOBLE ROLL", unitPrice: 4.6, amount: 4.6 },
      {
        quantity: 4.076,
        name: "MELON PIEL SAPO",
        unitPrice: 0.7,
        amount: 2.85,
        note: "4,076 kg × 0,70 €/kg",
      },
    ],
  ),
];

export function extractedToCents(ticket: ExtractedTicket) {
  const lines = ticket.lines.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    unitCents: eurosToCents(line.unitPrice),
    amountCents: eurosToCents(line.amount),
    vatRate: line.vatRate,
    note: line.note,
  }));
  return {
    totalCents: eurosToCents(ticket.total),
    lines,
    linesSumCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
  };
}
