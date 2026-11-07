/** Business defaults and allowed ranges (FR-10). These are rules, not environment values. */
export const SETTING_DEFINITIONS = {
  holdDurationMinutes: { defaultValue: 5, min: 1, max: 60 },
  maxSeatsPerBooking: { defaultValue: 4, min: 1, max: 10 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export type Limits = Record<SettingKey, number>;

export function defaultLimits(): Limits {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTING_DEFINITIONS[k].defaultValue])) as Limits;
}
