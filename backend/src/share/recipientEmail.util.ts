// An address only says who someone is once they confirmed it. Without email
// verification anyone can sign up with, or rename their account to, the
// address a share was sent to, so matching recipients by address is off then.
// A pending activation token means a new address that is not confirmed yet.
export function hasConfirmedEmail(
  user: { isActivated: boolean; activationToken: string | null },
  verificationEnabled: boolean,
) {
  return verificationEnabled && user.isActivated && !user.activationToken;
}
