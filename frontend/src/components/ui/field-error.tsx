import { AlertCircle } from "lucide-react";

/** Inline validation message under a field. Renders nothing when empty, so it
 *  can be dropped in unconditionally without a wrapper conditional. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 px-1 text-xs text-status-flag">
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
