import { AppError } from '../../shared/errors.js';

export const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export type PackageStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';

export interface PackageDateStateInput {
  startsOn: string;
  expiresOn: string;
  remainingCredits: number;
}

export interface PackageDerivedState {
  status: PackageStatus;
  daysUntilExpiration: number;
  expiringSoon: boolean;
}

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function isValidCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number(match[1]) < 1) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function businessDateKey(instant = new Date()): string {
  const parts = Object.fromEntries(
    businessDateFormatter.formatToParts(instant)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;

  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'No se pudo calcular la vigencia del paquete.', { startsOn: 'Revisá la fecha de inicio y la duración del tipo.' });
  }

  date.setUTCDate(date.getUTCDate() + amount);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1 || year > 9999) {
    throw new AppError(422, 'VALIDATION_ERROR', 'La fecha de vencimiento queda fuera del rango YYYY-MM-DD.', { startsOn: 'Revisá la fecha de inicio y la duración del tipo.' });
  }

  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function toDatabaseDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function fromDatabaseDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function daysUntilDate(dateKey: string, today: string): number {
  const target = Date.parse(`${dateKey}T00:00:00.000Z`);
  const current = Date.parse(`${today}T00:00:00.000Z`);
  return (target - current) / 86_400_000;
}

export function derivePackageState(input: PackageDateStateInput, today: string): PackageDerivedState {
  const daysUntilExpiration = daysUntilDate(input.expiresOn, today);
  let status: PackageStatus;

  if (today < input.startsOn) status = 'NOT_STARTED';
  else if (today > input.expiresOn) status = 'EXPIRED';
  else if (input.remainingCredits === 0) status = 'EXHAUSTED';
  else status = 'ACTIVE';

  return {
    status,
    daysUntilExpiration,
    expiringSoon: status === 'ACTIVE' && daysUntilExpiration >= 0 && daysUntilExpiration <= 7,
  };
}
