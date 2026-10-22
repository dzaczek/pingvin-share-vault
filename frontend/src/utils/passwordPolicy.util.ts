import * as yup from "yup";
import { CustomPasswordPolicy } from "../types/config.type";

// What the create-user form should enforce.
//
// The individual security.require* settings only apply when the custom policy
// is switched on. With it off the form falls back to a fixed minimum and no
// character requirements, deliberately ignoring whatever those settings happen
// to say, so that turning the policy off really does turn all of it off.
// built fresh each time, so a caller that edits what it gets back cannot
// change what the next one sees
const noPolicy = (): CustomPasswordPolicy => ({
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecialCharacter: false,
});

export function resolvePasswordPolicy(
  get: (key: string) => any,
): CustomPasswordPolicy {
  if (!get("security.customPasswordPolicy")) return noPolicy();

  return {
    minLength: get("security.minLength"),
    requireUppercase: get("security.requireUppercase"),
    requireLowercase: get("security.requireLowercase"),
    requireNumber: get("security.requireNumber"),
    requireSpecialCharacter: get("security.requireSpecialCharacter"),
  };
}

// A new password checked the way the server will check it. Callers add
// .required() where the field has to be filled in.
export function passwordSchema(
  policy: CustomPasswordPolicy,
  t: (id: string, values?: Record<string, number>) => string,
) {
  return yup
    .string()
    .min(
      policy.minLength,
      t("common.error.too-short", { length: policy.minLength }),
    )
    .matches(
      policy.requireLowercase ? /[a-z]/ : /.*/,
      t("common.error.password.lowercase"),
    )
    .matches(
      policy.requireUppercase ? /[A-Z]/ : /.*/,
      t("common.error.password.uppercase"),
    )
    .matches(
      policy.requireNumber ? /[0-9]/ : /.*/,
      t("common.error.password.number"),
    )
    .matches(
      policy.requireSpecialCharacter ? /[^a-zA-Z0-9]/ : /.*/,
      t("common.error.password.special"),
    );
}
