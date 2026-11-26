import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { ErrorState, LoadingState, PageHeader } from '../../shared/components/ui';
import { useResource } from '../../shared/services/useResource';
import type { ApiData } from '../../shared/types/api';
import { formatBuenosAiresInstant, formatCivilDate } from './packages.dates';
import type { MemberPackage } from './packages.types';
import { packageStatusLabels } from './packages.types';

export function MemberPackageDetailPage() {
  const { user } = useSession();
  const { id } = useParams();
  const isAdmin = user?.role === 'ADMIN';
  const basePath = isAdmin ? '/admin/paquetes' : '/socio/paquetes';
  const result = useResource<ApiData<MemberPackage>>(`/member-packages/${id ?? ''}`);

  return <>
    <Link className="back-link" to={basePath}>← Volver a {isAdmin ? 'paquetes' : 'mis paquetes'}</Link>
    {result.loading && <LoadingState label="Cargando detalle del paquete…" />}
    {result.error && <ErrorState message={result.error} retry={result.refresh} />}
    {result.data && !result.error && <section className="card detail-card">
      <PageHeader eyebrow={isAdmin ? 'ADMINISTRACIÓN / PAQUETES' : 'MIS PAQUETES'} title={result.data.data.packageType.name} description={`Asignación #${result.data.data.id}`} />
      <div className="detail-person"><div><h2>{packageStatusLabels[result.data.data.status]}</h2><p className="muted">{result.data.data.expiringSoon ? 'Próximo a vencer' : 'No próximo a vencer'}</p></div></div>
      <dl className="details">
        {isAdmin && <div><dt>Socio</dt><dd>{result.data.data.member.name}</dd></div>}
        <div><dt>Tipo de paquete</dt><dd>{result.data.data.packageType.name}</dd></div>
        <div><dt>Créditos incluidos</dt><dd>{result.data.data.initialCredits}</dd></div>
        <div><dt>Saldo actual</dt><dd>{result.data.data.remainingCredits} de {result.data.data.initialCredits} créditos</dd></div>
        <div><dt>Fecha de inicio</dt><dd>{formatCivilDate(result.data.data.startsOn)}</dd></div>
        <div><dt>Fecha de vencimiento</dt><dd>{formatCivilDate(result.data.data.expiresOn)}</dd></div>
        <div><dt>Asignado el</dt><dd>{formatBuenosAiresInstant(result.data.data.assignedAt)}</dd></div>
        <div><dt>Próximo vencimiento</dt><dd>{result.data.data.expiringSoon ? 'Sí, dentro de los próximos siete días' : 'No'}</dd></div>
      </dl>
    </section>}
  </>;
}
