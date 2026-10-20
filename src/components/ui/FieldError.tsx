/** A validation message tied to its field: give the field `aria-describedby={id}` and `aria-invalid`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} role="alert" className="mt-1 block text-xs font-medium text-danger">{message}</span>;
}
