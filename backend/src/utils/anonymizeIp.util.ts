import { NextFunction, Request, Response } from "express";
import { isIPv4, isIPv6 } from "net";

// IPv4 keeps its first three octets, IPv6 its first 48 bits
export function anonymizeIp(ip?: string) {
  if (!ip) return ip;

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1];

  if (isIPv4(ip)) return ip.replace(/\.\d+$/, ".0");
  if (!isIPv6(ip)) return ip;

  const [head, tail = ""] = ip.split("::");
  const front = head ? head.split(":") : [];
  const back = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = [
    ...front,
    ...Array(8 - front.length - back.length).fill("0"),
    ...back,
  ];
  return `${groups.slice(0, 3).join(":")}::`;
}

// req.ip is a getter, everything after this reads the shortened address
export function anonymizeIpMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  Object.defineProperty(req, "ip", { value: anonymizeIp(req.ip) });
  next();
}
