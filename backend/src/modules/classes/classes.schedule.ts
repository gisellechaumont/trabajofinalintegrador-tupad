import { AppError } from '../../shared/errors.js';

const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const MAX_INCLUSIVE_RANGE_DAYS = 84;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export interface WeeklyClassScheduleInput {
  startsAt: string;
  endsAt: string;
  daysOfWeek: number[];
  repeatUntil: string;
}

export interface ClassOccurrence {
  startsAt: Date;
  endsAt: Date;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function localParts(instant: Date): LocalDateTimeParts {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: instant.getUTCMilliseconds(),
  };
}

function dateKey({ year, month, day }: LocalDateTimeParts) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AppError(422, 'INVALID_RECURRENCE_RANGE', 'La fecha final debe usar el formato AAAA-MM-DD.');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(422, 'INVALID_RECURRENCE_RANGE', 'La fecha final no es válida.');
  }
  return { year, month, day, date };
}

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function addCalendarDays(value: string, amount: number) {
  const date = new Date(dayNumber(value));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isoWeekday(value: string) {
  const day = new Date(dayNumber(value)).getUTCDay();
  return day === 0 ? 7 : day;
}

function instantForLocalDate(date: string, time: LocalDateTimeParts) {
  const { year, month, day } = parseDateKey(date);
  const expected = {
    year,
    month,
    day,
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  };
  const target = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, time.millisecond);
  let candidate = target;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const instant = new Date(candidate);
    const actual = localParts(instant);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, actual.millisecond);
    const adjustment = target - represented;
    if (adjustment === 0) {
      if (
        actual.year === expected.year && actual.month === expected.month && actual.day === expected.day
        && actual.hour === expected.hour && actual.minute === expected.minute && actual.second === expected.second
      ) return instant;
      break;
    }
    candidate += adjustment;
  }

  throw new AppError(422, 'INVALID_CLASS_TIME', 'El horario no existe en America/Argentina/Buenos_Aires.');
}

export function generateWeeklyClassOccurrences(
  input: WeeklyClassScheduleInput,
  now = new Date(),
): ClassOccurrence[] {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const startLocal = localParts(startsAt);
  const endLocal = localParts(endsAt);
  const startDate = dateKey(startLocal);
  const endDate = dateKey(endLocal);

  if (startDate !== endDate || endsAt <= startsAt) {
    throw new AppError(422, 'INVALID_CLASS_TIME', 'La clase debe comenzar y finalizar el mismo día local, y la finalización debe ser posterior al inicio.');
  }
  if (startsAt <= now) {
    throw new AppError(422, 'CLASS_MUST_BE_FUTURE', 'La clase debe comenzar en una fecha futura.', { startsAt: 'Elegí una fecha y hora futura.' });
  }

  const repeatUntil = parseDateKey(input.repeatUntil);
  const startDayNumber = dayNumber(startDate);
  const finalDayNumber = repeatUntil.date.getTime();
  const rangeDays = (finalDayNumber - startDayNumber) / DAY_IN_MILLISECONDS + 1;
  if (rangeDays < 1 || rangeDays > MAX_INCLUSIVE_RANGE_DAYS) {
    throw new AppError(422, 'INVALID_RECURRENCE_RANGE', 'El rango debe incluir entre 1 y 84 fechas de calendario.');
  }

  const selectedDays = new Set(input.daysOfWeek);
  const occurrences: ClassOccurrence[] = [];
  for (let offset = 0; offset < rangeDays; offset += 1) {
    const occurrenceDate = addCalendarDays(startDate, offset);
    if (!selectedDays.has(isoWeekday(occurrenceDate))) continue;

    const occurrenceStart = instantForLocalDate(occurrenceDate, startLocal);
    const occurrenceEnd = instantForLocalDate(occurrenceDate, endLocal);
    if (occurrenceStart <= now) {
      throw new AppError(422, 'CLASS_MUST_BE_FUTURE', 'Todas las clases generadas deben comenzar en el futuro.', { startsAt: `La fecha ${occurrenceDate} ya pasó.` });
    }
    if (occurrenceEnd <= occurrenceStart) {
      throw new AppError(422, 'INVALID_CLASS_TIME', 'La finalización debe ser posterior al inicio.');
    }
    occurrences.push({ startsAt: occurrenceStart, endsAt: occurrenceEnd });
  }

  if (occurrences.length === 0) {
    throw new AppError(422, 'NO_CLASS_OCCURRENCES', 'El rango y los días seleccionados no generan ninguna clase.');
  }

  return occurrences;
}
