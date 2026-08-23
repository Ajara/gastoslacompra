import type { Category } from "./types";

const LIMPIEZA =
  /suavizante|lej[ií]a|detergente|higienico|higi[eé]nico|limpiador|lavavajillas|gel con lejia|papel (higienico|wc)|bayeta|lejia/i;

const BEBIDA =
  /cola|ice tea|zumo|batido|cerveza|agua |naranja zero|limon zero|lim[oó]n zero|coca cola|refresco/i;

const OTROS = /chicle|bolsa|pilas?|mecheros?|tabaco/i;

export const CATEGORY_LABEL: Record<Category, string> = {
  comida: "Comida",
  bebida: "Bebida",
  limpieza: "Limpieza",
  otros: "Otros",
};

export function categorize(name: string): Category {
  if (LIMPIEZA.test(name)) return "limpieza";
  if (OTROS.test(name)) return "otros";
  if (BEBIDA.test(name)) return "bebida";
  return "comida";
}

export function normalizeAlias(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9./+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
