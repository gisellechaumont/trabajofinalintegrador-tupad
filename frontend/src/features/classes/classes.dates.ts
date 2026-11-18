const TIME_ZONE = 'America/Argentina/Buenos_Aires';

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
