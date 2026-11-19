import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader } from '../../shared/components/ui';
import { ApiError, errorMessage, isAbort } from '../../shared/services/http';
import { createPackageType, getPackageType, updatePackageType } from './packages.api';
import type { PackageType, PackageTypeCreateInput, PackageTypePatchInput } from './packages.types';

const EMPTY_FORM = { name: '', classCredits: '', durationDays: '' };

export function PackageTypeFormPage({ editing = false }: { editing?: boolean }) {
  const { api } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [original, setOriginal] = useState<PackageType | null>(null);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editing) { setForm(EMPTY_FORM); setOriginal(null); setLoading(false); setLoadError(''); return; }
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    getPackageType(api, id ?? '').then(({ data }) => {
      if (!controller.signal.aborted) {
        setOriginal(data);
        setForm({ name: data.name, classCredits: String(data.classCredits), durationDays: String(data.durationDays) });
      }
    }).catch((failure: unknown) => {
      if (!isAbort(failure) && !controller.signal.aborted) setLoadError(errorMessage(failure));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, id, editing, revision]);

  const numericValuesValid = Number.isInteger(Number(form.classCredits)) && Number(form.classCredits) > 0
    && Number.isInteger(Number(form.durationDays)) && Number(form.durationDays) > 0;
  const hasChanges = !editing || Boolean(original && (
    form.name.trim() !== original.name
    || Number(form.classCredits) !== original.classCredits
    || Number(form.durationDays) !== original.durationDays
  ));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextFields: Record<string, string> = {};
    if (!form.name.trim()) nextFields.name = 'Ingresá un nombre.';
    if (!Number.isInteger(Number(form.classCredits)) || Number(form.classCredits) <= 0) nextFields.classCredits = 'Ingresá una cantidad entera mayor que cero.';
    if (!Number.isInteger(Number(form.durationDays)) || Number(form.durationDays) <= 0) nextFields.durationDays = 'Ingresá una duración entera mayor que cero.';
    setFields(nextFields); setError('');
    if (Object.keys(nextFields).length) return;

    const values: PackageTypeCreateInput = { name: form.name.trim(), classCredits: Number(form.classCredits), durationDays: Number(form.durationDays) };
    let patch: PackageTypePatchInput = {};
    if (editing && original) {
      patch = {
        ...(values.name !== original.name ? { name: values.name } : {}),
        ...(values.classCredits !== original.classCredits ? { classCredits: values.classCredits } : {}),
        ...(values.durationDays !== original.durationDays ? { durationDays: values.durationDays } : {}),
      };
      if (!Object.keys(patch).length) return;
    }

    setBusy(true);
    try {
      if (editing) await updatePackageType(api, id ?? '', patch);
      else await createPackageType(api, values);
      navigate('/admin/tipos-paquete', { replace: true, state: { notice: editing ? 'Tipo de paquete actualizado correctamente.' : 'Tipo de paquete creado correctamente.' } });
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally { setBusy(false); }
  }

  return <>
    <Link className="back-link" to="/admin/tipos-paquete">← Volver a tipos de paquete</Link>
    <PageHeader eyebrow="ADMINISTRACIÓN / PAQUETES" title={editing ? 'Editar tipo de paquete' : 'Crear tipo de paquete'} description="Definí los créditos incluidos y la duración que se copiarán en futuras asignaciones." />
    {loading ? <LoadingState label="Cargando tipo de paquete…" /> : loadError ? <ErrorState message={loadError} retry={() => setRevision((value) => value + 1)} /> : <form className="card form-card narrow" onSubmit={submit} noValidate>
      {error && <Alert>{error}</Alert>}
      <Field label="Nombre" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={100} required disabled={busy} error={fields.name} placeholder="Por ejemplo, Plan mensual" />
      <Field label="Créditos incluidos" type="number" min="1" step="1" value={form.classCredits} onChange={(event) => setForm((current) => ({ ...current, classCredits: event.target.value }))} required disabled={busy} error={fields.classCredits} />
      <Field label="Duración en días" type="number" min="1" step="1" value={form.durationDays} onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))} required disabled={busy} error={fields.durationDays} />
      {!numericValuesValid && (form.classCredits !== '' || form.durationDays !== '') && <p className="small muted">Los créditos y la duración deben ser enteros mayores que cero.</p>}
      <div className="form-actions"><Link className="button secondary" to="/admin/tipos-paquete">Cancelar</Link><Button type="submit" disabled={busy || (editing && !hasChanges)}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear tipo de paquete'}</Button></div>
    </form>}
  </>;
}
