/**
 * SIMULATED cohort data for the Impact screen.
 *
 * The brief explicitly permits mocked inputs. It does not permit presenting
 * mocked data as real, so every surface that renders this is labelled.
 *
 * The shape is what matters: a baseline week, two arms, and a retention curve.
 * This is the study we would run, instrumented as if we had run it.
 */

export const COHORT = 120;
export const BASELINE_DAYS = 7;

/** Verified recycling actions per user per week, by study week. */
export const WEEKLY = [
  { week: 0, label: "Baseline", bear: 1.8, control: 1.8 },
  { week: 1, label: "Week 1", bear: 3.4, control: 2.1 },
  { week: 2, label: "Week 2", bear: 3.1, control: 1.9 },
  { week: 3, label: "Week 3", bear: 2.9, control: 1.8 },
  { week: 4, label: "Week 4", bear: 2.7, control: 1.7 },
];

/** Share of each arm still logging at least once that week. */
export const RETENTION = [
  { day: 1, bear: 100, control: 100 },
  { day: 7, bear: 84, control: 61 },
  { day: 14, bear: 71, control: 42 },
  { day: 21, bear: 63, control: 31 },
  { day: 30, bear: 58, control: 24 },
];

export const TARGET_LIFT = 40;
export const TARGET_D30 = 50;

const base = WEEKLY[0].bear;
const wk4 = WEEKLY[WEEKLY.length - 1].bear;

export const ACTUAL_LIFT = Math.round(((wk4 - base) / base) * 100);
export const ACTUAL_D30 = RETENTION[RETENTION.length - 1].bear;

/** Vanity metrics — shown deliberately, and labelled as not the point. */
export const VANITY = [
  { label: "Photos uploaded", value: "1,284" },
  { label: "App opens", value: "3,907" },
  { label: "Longest streak", value: "23 days" },
];
