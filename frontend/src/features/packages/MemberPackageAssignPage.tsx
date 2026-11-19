import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader } from '../../shared/components/ui';
import { ApiError, errorMessage, isAbort } from '../../shared/services/http';
import { createMemberPackage, fetchAllActiveMembers, fetchAllActivePackageTypes } from './packages.api';
import { currentBuenosAiresDate, isCivilDate } from './packages.dates';
import type { MemberPackageCreateInput, PackageType } from './packages.types';
import type { User } from '../../shared/types/api';

export function MemberPackageAssignPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [members, setMembers] = useState<User[]>([]);
  const [types, setTypes] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState({ memberId: '', packageTypeId: '', startsOn: currentBuenosAiresDate() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    Promise.all([fetchAllActiveMembers(api), fetchAllActivePackageTypes(api)])
      .then(([activeMembers, activeTypes]) => {
        if (!controller.signal.aborted) { setMembers(activeMembers); setTypes(activeTypes); }
      })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextFields: Record<string, string> = {};
    if (!form.memberId) nextFields.memberId = 'Seleccioná un socio activo.';
    if (!form.packageTypeId) nextFields.packageTypeId = 'Seleccioná un tipo de paquete activo.';
    if (!isCivilDate(form.startsOn)) nextFields.startsOn = 'Ingresá una fecha civil válida.';
    setFields(nextFields); setError('');
    if (Object.keys(nextFields).length) return;

    const input: MemberPackageCreateInput = {
      memberId: Number(form.memberId),
      packageTypeId: Number(form.packageTypeId),
      startsOn: form.startsOn,
    };
    setBusy(true);
    try {
      await createMemberPackage(api, input);
      navigate('/admin/paquetes', { replace: true, state: { notice: 'Paquete asignado correctamente.' } });
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally { setBusy(false); }
  }

  return <>
    <Link className="back-link" to="/admin/paquetes">← Volver a paquetes</Link>
    <PageHeader eyebrow="ADMINISTRACIÓN / PAQUETES" title="Asignar paquete" description="Asigná un tipo activo a un socio activo. Los créditos y fechas se guardan como snapshots." />
    {loading ? <LoadingState label="Cargando socios y tipos activos…" /> : loadError ? <ErrorState message={loadError} retry={() => setRevision((value) => value + 1)} /> : !members.length || !types.length ? <Alert tone="info">{!members.length && !types.length ? 'No hay socios ni tipos de paquete activos para asignar.' : !members.length ? 'No hay socios activos disponibles.' : 'No hay tipos de paquete activos disponibles.'}</Alert> : <form className="card form-card narrow" onSubmit={submit} noValidate>
      {error && <Alert>{error}</Alert>}
      <div className="field"><label htmlFor="memberId">Socio</label><select id="memberId" value={form.memberId} required disabled={busy} aria-invalid={Boolean(fields.memberId)} aria-describedby={fields.memberId ? 'memberId-error' : undefined} onChange={(event) => setForm((current) => ({ ...current, memberId: event.target.value }))}>
        <option value="">Seleccioná un socio activo</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>{fields.memberId && <small role="alert" id="memberId-error" className="field-error">{fields.memberId}</small>}</div>
      <div className="field"><label htmlFor="packageTypeId">Tipo de paquete</label><select id="packageTypeId" value={form.packageTypeId} required disabled={busy} aria-invalid={Boolean(fields.packageTypeId)} aria-describedby={fields.packageTypeId ? 'packageTypeId-error' : undefined} onChange={(event) => setForm((current) => ({ ...current, packageTypeId: event.target.value }))}>
        <option value="">Seleccioná un tipo activo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.classCredits} créditos · {type.durationDays} {type.durationDays === 1 ? 'día' : 'días'}</option>)}
      </select>{fields.packageTypeId && <small role="alert" id="packageTypeId-error" className="field-error">{fields.packageTypeId}</small>}</div>
      <Field label="Fecha de inicio" type="date" value={form.startsOn} required disabled={busy} error={fields.startsOn} onChange={(event) => setForm((current) => ({ ...current, startsOn: event.target.value }))} />
      <p className="small muted">La fecha puede ser pasada, actual o futura. El vencimiento se calcula según la duración del tipo.</p>
      <div className="form-actions"><Link className="button secondary" to="/admin/paquetes">Cancelar</Link><Button type="submit" disabled={busy}>{busy ? 'Asignando…' : 'Asignar paquete'}</Button></div>
    </form>}
  </>;
}
