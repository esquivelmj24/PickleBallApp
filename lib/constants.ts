export const MAX_COURTS = 6;

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"];

export function genderLabel(value: Gender | null | undefined): string {
  return GENDERS.find((gender) => gender.value === value)?.label ?? "Not specified";
}
