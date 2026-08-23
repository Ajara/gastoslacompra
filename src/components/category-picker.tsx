"use client";

import { updateProductCategoryAction } from "@/lib/actions";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/lib/types";

const OPTIONS: Category[] = ["comida", "bebida", "limpieza", "otros"];

export function CategoryPicker({
  productId,
  value,
}: {
  productId: string;
  value: Category;
}) {
  return (
    <select
      defaultValue={value}
      className="h-10 rounded-xl border border-line bg-card px-3 text-sm"
      onChange={(event) => {
        void updateProductCategoryAction(productId, event.target.value);
      }}
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {CATEGORY_LABEL[option]}
        </option>
      ))}
    </select>
  );
}
