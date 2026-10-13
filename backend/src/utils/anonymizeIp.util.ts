import { NextFunction, Request, Response } from "express";
import { isIPv4, isIPv6 } from "net";

// an IPv4 address written as IPv6 is handled as the IPv4 address it is
const unmapped = (ip: string) =>
  ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? ip;

const ipv6Groups = (ip: string) => {
  const [head, tail = ""] = ip.split("::");
  const front = head ? head.split(":") : [];
  const back = ip.includes("::") && tail ? tail.split(":") : [];
  return [
    ...front,
    ...Array(8 - front.length - back.length).fill("0"),
    ...back,
  ];
};

// IPv4 keeps its first three octets, IPv6 its first 48 bits
export function anonymizeIp(ip?: string) {
  if (!ip) return ip;
  ip = unmapped(ip);
  if (isIPv4(ip)) return ip.replace(/\.\d+$/, ".0");
  if (!isIPv6(ip)) return ip;
  return `${ipv6Groups(ip).slice(0, 3).join(":")}::`;
}

// only the first and the last part stay, for addresses shown in public
export function maskIp(ip?: string) {
  if (!ip) return ip;
  ip = unmapped(ip);
  if (isIPv4(ip)) return ip.replace(/^(\d+)\.\d+\.\d+\.(\d+)$/, "$1.*.*.$2");
  if (!isIPv6(ip)) return ip;
  const groups = ipv6Groups(ip);
  return `${groups[0]}:*:${groups[7]}`;
}

// ANONYMIZE_IP=true shortens every address, ANONYMIZE_IP=mask masks it.
// req.ip is a getter, everything after this reads the changed address.
export function anonymizeIpMiddleware(mode?: string) {
  const change = { true: anonymizeIp, mask: maskIp }[mode ?? ""];
  if (!change) return undefined;
  return (req: Request, _res: Response, next: NextFunction) => {
    Object.defineProperty(req, "ip", { value: change(req.ip) });
    next();
  };
}
