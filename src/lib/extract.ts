import type { ExtractedTicket } from "./types";

const SYSTEM_PROMPT = `Eres un extractor de tickets de supermercado de España (Mercadona, DIA, Carrefour, Lidl, Aldi, Alcampo, etc.).
Devuelves SOLO un JSON válido con este esquema:
{
  "store": string,
  "purchasedAt": string (ISO-8601, fecha y hora del ticket),
  "total": number (euros, con punto decimal),
  "paymentMethod": string | null,
  "invoiceNumber": string | null,
  "lines": [
    {
      "quantity": number,
      "name": string,
      "unitPrice": number,
      "amount": number,
      "vatRate": number | null,
      "note": string | null
    }
  ]
}

Reglas:
- Cada producto del ticket es una línea. No inventes productos.
- quantity es 1 si no hay cantidad. Si pone "2 PAN..." quantity=2. Si es a peso, quantity es los kg (ej. 4.076) y unitPrice el €/kg.
- amount es el importe de la línea (lo que se paga por ese producto).
- unitPrice es el precio unitario; si no aparece, usa amount/quantity.
- name en mayúsculas como en el ticket, sin el importe.
- Ignora publicidad, fidelización, desglose IVA como líneas de producto, y el cargo de tarjeta.
- total es el TOTAL A PAGAR, no la base imponible.
- Números en formato JSON (76.12 no 76,12).`;

function parseExtracted(raw: string): ExtractedTicket {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  const parsed = JSON.parse(cleaned) as ExtractedTicket;
  if (!parsed || !Array.isArray(parsed.lines) || typeof parsed.total !== "number") {
    throw new Error("La extracción no devolvió un ticket válido");
  }
  return {
    store: String(parsed.store || "Tienda"),
    purchasedAt: parsed.purchasedAt || new Date().toISOString(),
    total: Number(parsed.total),
    paymentMethod: parsed.paymentMethod ? String(parsed.paymentMethod) : null,
    invoiceNumber: parsed.invoiceNumber ? String(parsed.invoiceNumber) : null,
    lines: parsed.lines.map((line) => ({
      quantity: Number(line.quantity) || 1,
      name: String(line.name || "").trim() || "Producto",
      unitPrice: Number(line.unitPrice) || 0,
      amount: Number(line.amount) || 0,
      vatRate: line.vatRate == null ? null : Number(line.vatRate),
      note: line.note ? String(line.note) : null,
    })),
  };
}

async function extractWithOpenAI(
  base64: string,
  mime: string,
  apiKey: string,
): Promise<ExtractedTicket> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae todas las líneas de este ticket.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");
  return parseExtracted(content);
}

async function extractWithAnthropic(
  base64: string,
  mime: string,
  apiKey: string,
): Promise<ExtractedTicket> {
  const mediaType =
    mime === "image/png" || mime === "image/webp" || mime === "image/gif"
      ? mime
      : "image/jpeg";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "Extrae todas las líneas de este ticket." },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic no devolvió contenido");
  return parseExtracted(text);
}

export async function extractReceipt(
  image: Buffer,
  mime: string,
): Promise<ExtractedTicket> {
  const base64 = image.toString("base64");
  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;

  if (openai) return extractWithOpenAI(base64, mime, openai);
  if (anthropic) return extractWithAnthropic(base64, mime, anthropic);

  throw new Error(
    "Falta OPENAI_API_KEY o ANTHROPIC_API_KEY para leer el ticket",
  );
}
