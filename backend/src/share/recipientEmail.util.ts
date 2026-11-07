// An address only says who someone is once they confirmed it. Without email
// verification anyone can sign up with, or rename their account to, the
// address a share was sent to, so matching recipients by address is off then.
// A pending activation token means a new address that is not confirmed yet.
// confirmedEmail records the address that was actually proven, so accounts
// made while verification was off, or given an address nobody checked, do not
// count once it is turned on.
export function hasConfirmedEmail(
  user: {
    email: string;
    isActivated: boolean;
    activationToken: string | null;
    confirmedEmail: string | null;
  },
  verificationEnabled: boolean,
) {
  return (
    verificationEnabled &&
    user.isActivated &&
    !user.activationToken &&
    !!user.confirmedEmail &&
    user.confirmedEmail === user.email
  );
}
