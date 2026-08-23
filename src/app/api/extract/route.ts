import { NextResponse } from "next/server";
import { extractReceipt } from "@/lib/extract";
import { getSessionUser } from "@/lib/household";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta la foto del ticket" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "La foto pesa demasiado (máx. 8 MB)" }, { status: 400 });
  }

  const mime = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const ticket = await extractReceipt(buffer, mime);
    return NextResponse.json(ticket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer el ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
