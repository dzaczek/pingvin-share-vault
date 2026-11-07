// Which proxy hops Express may take the client address from. req.ip feeds the
// rate limiter, the audit log and the share access log.
//
// The image always runs Caddy on loopback in front of the backend unless
// CADDY_DISABLED is set. Trusting nothing made every visitor the loopback
// address, so all of them shared one rate limit bucket and one visitor could
// block sign in for everyone. Trusting every hop (the old TRUST_PROXY=true)
// let a client choose its own address with X-Forwarded-For.
//
// So only the hops Caddy itself trusts are trusted here: loopback (Caddy),
// plus, with TRUST_PROXY=true, the same TRUST_PROXY_FROM ranges Caddy uses
// (the private networks by default). The address of the first untrusted hop
// counting from the right is the client.

// Caddy's private_ranges: 127/8, ::1, 10/8, 172.16/12, 192.168/16, fd00::/8
const PRIVATE_RANGES = ["loopback", "uniquelocal"];

const ADDRESS_OR_RANGE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

export function trustProxySetting(
  env: Record<string, string | undefined>,
): false | string[] {
  const behindBundledCaddy = env.CADDY_DISABLED !== "true";

  if (env.TRUST_PROXY !== "true") {
    return behindBundledCaddy ? ["loopback"] : false;
  }

  const listed = (env.TRUST_PROXY_FROM ?? "").split(/[\s,]+/).filter(Boolean);
  // entrypoint.sh falls back to the private networks when the list is empty
  // or not something Caddy can parse, the backend does the same
  const ranges =
    listed.length === 0 ||
    listed.includes("private_ranges") ||
    !listed.every((entry) => ADDRESS_OR_RANGE.test(entry))
      ? PRIVATE_RANGES
      : listed;

  return behindBundledCaddy
    ? Array.from(new Set(["loopback", ...ranges]))
    : ranges;
}
