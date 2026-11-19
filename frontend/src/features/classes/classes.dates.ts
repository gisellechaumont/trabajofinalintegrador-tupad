const TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const MAX_CLASS_BATCH_DATES = 84;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(date: Date) {
  return Object.fromEntries(partsFormatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
}

export function formatBuenosAires(value: string, withDate = true) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    ...(withDate ? { dateStyle: 'medium' as const } : {}),
    timeStyle: 'short',
  }).format(new Date(value));
}

export function isoToBuenosAiresInput(value: string) {
  const parts = zonedParts(new Date(value));
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function buenosAiresInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Ingresá una fecha y hora válidas.');
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const hour = Number(hourText); const minute = Number(minuteText);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(desired);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() + 1 !== month || normalized.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new RangeError('Ingresá una fecha y hora válidas.');
  }
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = zonedParts(new Date(candidate));
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const adjustment = desired - represented;
    if (adjustment === 0) return new Date(candidate).toISOString();
    candidate += adjustment;
  }
  throw new RangeError('No se pudo convertir la hora local de Buenos Aires.');
}

export function buenosAiresDayBoundaryToIso(value: string, nextDay = false) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Ingresá una fecha válida.');
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  const pad = (number: number) => String(number).padStart(2, '0');
  return buenosAiresInputToIso(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T00:00`);
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function buenosAiresDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = zonedParts(date);
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

export function addDaysToDateKey(value: string, amount: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('La fecha debe tener formato AAAA-MM-DD.');
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function weeklyClassDateKeys(startDate: string, daysOfWeek: number[], repeatUntil: string) {
  if (!isValidDateKey(startDate) || !isValidDateKey(repeatUntil) || daysOfWeek.length === 0) return [];
  const totalDates = (Date.parse(`${repeatUntil}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (totalDates < 1 || totalDates > MAX_CLASS_BATCH_DATES) return [];

  const selectedDays = new Set(daysOfWeek);
  return Array.from({ length: totalDates }, (_, offset) => addDaysToDateKey(startDate, offset))
    .filter((date) => {
      const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      return selectedDays.has(day === 0 ? 7 : day);
    });
}

export function weeklyClassRangeError(startDate: string, daysOfWeek: number[], repeatUntil: string) {
  if (!startDate) return 'Ingresá la fecha de inicio.';
  if (!repeatUntil) return 'La fecha final es obligatoria.';
  if (!isValidDateKey(startDate) || !isValidDateKey(repeatUntil)) return 'Ingresá fechas válidas.';
  if (!daysOfWeek.length) return 'Seleccioná al menos un día de la semana.';

  const totalDates = (Date.parse(`${repeatUntil}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (totalDates < 1) return 'La fecha final no puede ser anterior a la fecha de inicio.';
  if (totalDates > MAX_CLASS_BATCH_DATES) return 'El rango no puede superar 84 fechas de calendario.';
  if (!weeklyClassDateKeys(startDate, daysOfWeek, repeatUntil).length) return 'El rango y los días seleccionados no generan ninguna clase.';
  return '';
}

export function buenosAiresWeekStartKey(now = new Date()) {
  const today = buenosAiresDateKey(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDaysToDateKey(today, -((weekday + 6) % 7));
}

export function buenosAiresWeekDateKeys(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekStart, index));
}

export function buenosAiresWeekRange(weekStart: string) {
  return {
    from: buenosAiresDayBoundaryToIso(weekStart),
    to: buenosAiresDayBoundaryToIso(addDaysToDateKey(weekStart, 7)),
  };
}

export function formatBuenosAiresDateKey(value: string, weekday: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    weekday,
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00Z`));
}
