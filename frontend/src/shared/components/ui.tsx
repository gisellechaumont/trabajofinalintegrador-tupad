import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</header>;
}
export function Field({ label, error, hint, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generated = useId(); const inputId = id || generated;
  return <div className="field"><label htmlFor={inputId}>{label}</label><input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined} {...props} />{hint && <small id={`${inputId}-hint`} className="muted">{hint}</small>}{error && <small role="alert" id={`${inputId}-error`} className="field-error">{error}</small>}</div>;
}
export function Select({ label, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId(); const inputId = id || generated;
  return <div className="field"><label htmlFor={inputId}>{label}</label><select id={inputId} {...props} /></div>;
}
export function TextArea({ label, error, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const generated = useId(); const inputId = id || generated;
  return <div className="field"><label htmlFor={inputId}>{label}</label><textarea id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />{error && <small role="alert" id={`${inputId}-error`} className="field-error">{error}</small>}</div>;
}
export function StatusBadge({ active }: { active: boolean }) { return <span className={`badge ${active ? 'active' : 'inactive'}`}><span aria-hidden="true" className="status-dot" />{active ? 'Activo' : 'Inactivo'}</span>; }
export function Alert({ children, tone = 'error' }: PropsWithChildren<{ tone?: 'error' | 'success' | 'info' }>) { return <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>; }
export function LoadingState({ label = 'Cargando información…' }: { label?: string }) { return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>; }
export function EmptyState({ title, children }: PropsWithChildren<{ title: string }>) { return <div className="empty-state"><span className="empty-mark" aria-hidden="true">—</span><h2>{title}</h2><p className="muted">{children}</p></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-state"><Alert>{message}</Alert>{retry && <Button variant="secondary" onClick={retry}>Reintentar</Button>}</div>; }
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange(page: number): void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="pagination" aria-label="Páginas del listado"><span className="muted">{total} {total === 1 ? 'registro' : 'registros'} · Página {page} de {pages}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button></div></nav>;
}
export function ConfirmDialog({ open, title, children, busy, confirmLabel, onConfirm, onClose }: PropsWithChildren<{ open: boolean; title: string; busy?: boolean; confirmLabel: string; onConfirm(): void; onClose(): void }>) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><div className="dialog-body"><p className="eyebrow">Confirmación</p><h2 id={titleId}>{title}</h2><div className="muted">{children}</div><div className="form-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Volver</Button><Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Guardando…' : confirmLabel}</Button></div></div></dialog>;
}
