import { User } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";

// Holds the current request so the audit log can read ip, user agent and
// visitor without every service passing them down.
export const auditRequestStore = new AsyncLocalStorage<Request>();

export function auditRequestMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  auditRequestStore.run(req, next);
}

// what the frontend puts in the headers and the cookies, a hex hash for the
// visitor and a random hex id for the device
const VISITOR_ID = /^[a-f0-9]{16,64}$/;

const pick = (...values: unknown[]) =>
  (values.find((v) => typeof v === "string" && VISITOR_ID.test(v)) as
    string | undefined) ?? null;

export function requestContext(req?: Request) {
  if (!req)
    return {
      ipAddress: "",
      userAgent: "",
      visitorId: null,
      deviceId: null,
      user: undefined,
    };

  // the header comes with api calls, the cookie with everything else, plain
  // downloads and previews included
  const visitorId = pick(
    req.header("x-browser-fingerprint"),
    req.cookies?.visitor_id,
  );
  const deviceId = pick(req.header("x-device-id"), req.cookies?.device_id);

  return {
    ipAddress: req.ip ?? "",
    userAgent: (req.header("user-agent") ?? "").slice(0, 512),
    visitorId,
    deviceId,
    user: req.user as User | undefined,
  };
}
