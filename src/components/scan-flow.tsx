"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatCents,
  formatEuroInput,
  isMismatch,
  linesSumCents,
  parseEuroInput,
} from "@/lib/money";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/dates";
import type { DraftLine, ExtractedTicket, TicketDraft } from "@/lib/types";
import { eurosToCents } from "@/lib/money";

function newLine(): DraftLine {
  return {
    id: crypto.randomUUID(),
    quantity: 1,
    name: "",
    unitCents: 0,
    amountCents: 0,
    vatRate: null,
    note: null,
  };
}

function toDraft(extracted: ExtractedTicket): TicketDraft {
  return {
    store: extracted.store,
    purchasedAt: extracted.purchasedAt,
    totalCents: eurosToCents(extracted.total),
    paymentMethod: extracted.paymentMethod ?? "",
    invoiceNumber: extracted.invoiceNumber ?? "",
    lines: extracted.lines.map((line) => ({
      id: crypto.randomUUID(),
      quantity: line.quantity,
      name: line.name,
      unitCents: eurosToCents(line.unitPrice),
      amountCents: eurosToCents(line.amount),
      vatRate: line.vatRate,
      note: line.note,
    })),
  };
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      "image/jpeg",
      0.82,
    );
  });
}

export function ScanFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "reading" | "review">("idle");
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);

  const sum = useMemo(
    () => (draft ? linesSumCents(draft.lines) : 0),
    [draft],
  );
  const mismatch = draft ? isMismatch(draft.totalCents, sum) : false;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setConfirmMismatch(false);
    setStep("reading");
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));

      const body = new FormData();
      body.append("file", compressed, "ticket.jpg");
      const response = await fetch("/backend/extract", {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = (await response.json()) as ExtractedTicket & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "No se pudo leer");
      setDraft(toDraft(payload));
      setStep("review");
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "No se pudo leer el ticket");
    }
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        lines: current.lines.map((line) => {
          if (line.id !== id) return line;
          const next = { ...line, ...patch };
          if (patch.quantity != null || patch.unitCents != null) {
            const qty = patch.quantity ?? next.quantity;
            const unit = patch.unitCents ?? next.unitCents;
            next.amountCents = Math.round(qty * unit);
          }
          return next;
        }),
      };
    });
  }

  async function save() {
    if (!draft) return;
    if (mismatch && !confirmMismatch) {
      setConfirmMismatch(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ticketId = crypto.randomUUID();
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          ticketId,
          store: draft.store,
          purchasedAt: draft.purchasedAt,
          totalCents: draft.totalCents,
          paymentMethod: draft.paymentMethod || null,
          invoiceNumber: draft.invoiceNumber || null,
          lines: draft.lines
            .filter((line) => line.name.trim())
            .map((line) => ({
              name: line.name.trim(),
              quantity: line.quantity,
              unitCents: line.unitCents,
              amountCents: line.amountCents,
              vatRate: line.vatRate,
              note: line.note,
            })),
        }),
      );
      if (photo) {
        form.append("photo", photo, "ticket.jpg");
      }
      const response = await fetch("/backend/tickets", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) {
        throw new Error(result.error || "Error al guardar");
      }
      router.push(`/ticket/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  if (step === "idle") {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escanear ticket</h1>
          <p className="mt-2 text-sm text-muted">
            Foto al salir de la tienda. Revisa las líneas antes de guardar.
          </p>
        </div>
        <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/20 bg-card px-6 text-center">
          <span className="text-sm font-medium text-scan">Hacer foto</span>
          <span className="text-sm text-muted">o elegirla de la galería</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>
        {error ? <p className="text-sm text-scan">{error}</p> : null}
      </div>
    );
  }

  if (step === "reading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
        <p className="text-lg font-medium">Leyendo el ticket…</p>
        <p className="text-sm text-muted">Suele tardar unos segundos.</p>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revisar</h1>
        <p className="mt-1 text-sm text-muted">
          Si las líneas no suman el total, corrige antes de guardar.
        </p>
      </div>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Ticket"
          className="max-h-40 w-full rounded-xl object-cover object-top"
        />
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Tienda</span>
        <input
          value={draft.store}
          onChange={(e) => setDraft({ ...draft, store: e.target.value })}
          className="h-11 rounded-xl border border-line bg-card px-3 outline-none focus:border-accent"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Fecha</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(draft.purchasedAt)}
            onChange={(e) =>
              setDraft({ ...draft, purchasedAt: fromDatetimeLocalValue(e.target.value) })
            }
            className="h-11 rounded-xl border border-line bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Total</span>
          <input
            inputMode="decimal"
            value={formatEuroInput(draft.totalCents)}
            onChange={(e) =>
              setDraft({ ...draft, totalCents: parseEuroInput(e.target.value) })
            }
            className="h-11 rounded-xl border border-line bg-card px-3 outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Líneas</h2>
        <p className={`text-sm ${mismatch ? "text-scan" : "text-muted"}`}>
          Suman {formatCents(sum)}
        </p>
      </div>

      {mismatch ? (
        <p className="rounded-xl bg-scan/10 px-3 py-2 text-sm text-scan">
          Las líneas no cuadran con el total ({formatCents(draft.totalCents)}).
          Corrige o confirma al guardar.
        </p>
      ) : (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
          Cuadra con el total.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {draft.lines.map((line) => (
          <li key={line.id} className="rounded-xl border border-line bg-card p-3">
            <input
              value={line.name}
              onChange={(e) => updateLine(line.id, { name: e.target.value })}
              className="mb-2 w-full bg-transparent text-sm font-medium outline-none"
              placeholder="Producto"
            />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Cant.</span>
                <input
                  inputMode="decimal"
                  value={String(line.quantity).replace(".", ",")}
                  onChange={(e) =>
                    updateLine(line.id, {
                      quantity: Number(e.target.value.replace(",", ".")) || 0,
                    })
                  }
                  className="h-10 rounded-lg border border-line px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">P. unit.</span>
                <input
                  inputMode="decimal"
                  value={formatEuroInput(line.unitCents)}
                  onChange={(e) =>
                    updateLine(line.id, { unitCents: parseEuroInput(e.target.value) })
                  }
                  className="h-10 rounded-lg border border-line px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Importe</span>
                <input
                  inputMode="decimal"
                  value={formatEuroInput(line.amountCents)}
                  onChange={(e) =>
                    updateLine(line.id, { amountCents: parseEuroInput(e.target.value) })
                  }
                  className="h-10 rounded-lg border border-line px-2"
                />
              </label>
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-muted"
              onClick={() =>
                setDraft({
                  ...draft,
                  lines: draft.lines.filter((item) => item.id !== line.id),
                })
              }
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="text-sm text-accent"
        onClick={() => setDraft({ ...draft, lines: [...draft.lines, newLine()] })}
      >
        Añadir línea
      </button>

      {error ? <p className="text-sm text-scan">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-md gap-2 px-4">
        <button
          type="button"
          className="h-12 flex-1 rounded-xl border border-line bg-card text-sm"
          onClick={() => {
            setStep("idle");
            setDraft(null);
            setPhoto(null);
          }}
        >
          Otra foto
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="h-12 flex-[2] rounded-xl bg-scan text-sm font-medium text-white disabled:opacity-60"
        >
          {saving
            ? "Guardando…"
            : confirmMismatch && mismatch
              ? "Guardar aunque no cuadre"
              : `Guardar ${formatCents(draft.totalCents)}`}
        </button>
      </div>
    </div>
  );
}
