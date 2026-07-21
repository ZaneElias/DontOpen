import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** "origin_address" -> "Origin address". Keeps raw schema keys out of UI copy. */
export function humanizeField(name: string): string {
  const s = name.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formats a field list for user-facing prose: "A, B and C". */
export function humanizeFieldList(names: string[]): string {
  const labels = names.map(humanizeField);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
