import {
  parseRelativeDateToAbsolute,
  stringToTimespan,
  timespanToString,
} from "./date.util";

describe("parseRelativeDateToAbsolute", () => {
  // guards compare an expiration against moment(0) to mean "no expiry",
  // so this has to stay exactly the epoch
  it("maps never to the epoch", () => {
    expect(parseRelativeDateToAbsolute("never").getTime()).toBe(0);
  });

  // Days and weeks are calendar days, the same time on the clock. Across a
  // daylight saving change that is an hour more or less than n * 24h, so the
  // expected values are built the same way instead of counting milliseconds.
  const later = (change: (d: Date) => void) => {
    const d = new Date();
    change(d);
    return d.getTime();
  };

  it("adds the given amount of time to now", () => {
    const expected = later((d) => d.setDate(d.getDate() + 1));
    const result = parseRelativeDateToAbsolute("1-days").getTime();
    expect(Math.abs(result - expected)).toBeLessThan(5000);
  });

  it("understands the units used by the share form", () => {
    const hour = parseRelativeDateToAbsolute("2-hours").getTime();
    const week = parseRelativeDateToAbsolute("1-weeks").getTime();

    expect(
      Math.abs(hour - later((d) => d.setHours(d.getHours() + 2))),
    ).toBeLessThan(5000);
    expect(
      Math.abs(week - later((d) => d.setDate(d.getDate() + 7))),
    ).toBeLessThan(5000);
  });

  it("keeps the clock time over a daylight saving change", () => {
    // in Zurich the clocks go back on 25 October 2026, run with
    // TZ=Europe/Zurich to cross it on any machine
    const start = new Date("2026-10-22T12:00:00+02:00");
    jest.useFakeTimers().setSystemTime(start);
    try {
      const expected = new Date(start);
      expected.setDate(start.getDate() + 7);
      expect(parseRelativeDateToAbsolute("1-weeks")).toEqual(expected);
    } finally {
      jest.useRealTimers();
    }
  });

  it("always returns a future date for a positive span", () => {
    expect(parseRelativeDateToAbsolute("1-minutes").getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});

describe("timespan parsing", () => {
  it("splits a config value into a number and a unit", () => {
    expect(stringToTimespan("7 days")).toEqual({ value: 7, unit: "days" });
    expect(stringToTimespan("0 days")).toEqual({ value: 0, unit: "days" });
    expect(stringToTimespan("3 months")).toEqual({ value: 3, unit: "months" });
  });

  it("round trips back to the same string", () => {
    for (const value of ["7 days", "1 hours", "12 months"]) {
      expect(timespanToString(stringToTimespan(value))).toBe(value);
    }
  });
});
