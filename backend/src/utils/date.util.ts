import * as moment from "moment";

// Note: stringToTimespan and timespanToString also exist in
// frontend/src/utils/date.util.ts. They are copied rather than shared, so a fix
// here does not reach the other one. Both sides have their own tests, and
// neither would notice the two disagreeing.

export function parseRelativeDateToAbsolute(relativeDate: string) {
  if (relativeDate == "never") return moment(0).toDate();

  return moment()
    .add(
      relativeDate.split("-")[0],
      relativeDate.split("-")[1] as moment.unitOfTime.DurationConstructor,
    )
    .toDate();
}

// SQLite stores dates as ISO text and compares them as text, which only
// agrees with the real order for four digit years. "+010026-..." sorts before
// "2026-...", so a share expiring then looks expired to every query.
export function isStorableDate(date: Date) {
  return !isNaN(date.getTime()) && date.getUTCFullYear() <= 9999;
}

type Timespan = {
  value: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
};

export function stringToTimespan(value: string): Timespan {
  const [time, unit] = value.split(" ");
  return {
    value: parseInt(time),
    unit: unit as Timespan["unit"],
  };
}

export function timespanToString(timespan: Timespan) {
  return `${timespan.value} ${timespan.unit}`;
}
