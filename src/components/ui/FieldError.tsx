/** A validation message tied to its field: give the field `aria-describedby={id}` and `aria-invalid`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} role="alert" className="text-red-400 text-xs block mt-1">{message}</span>;
}
