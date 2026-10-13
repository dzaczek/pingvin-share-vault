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

// what the frontend puts in the header and the cookie, a hex hash
const VISITOR_ID = /^[a-f0-9]{16,64}$/;

export function requestContext(req?: Request) {
  if (!req)
    return { ipAddress: "", userAgent: "", visitorId: null, user: undefined };

  // the header comes with api calls, the cookie with everything else, plain
  // downloads and previews included
  const visitorId =
    [req.header("x-browser-fingerprint"), req.cookies?.visitor_id].find(
      (v) => typeof v === "string" && VISITOR_ID.test(v),
    ) ?? null;

  return {
    ipAddress: req.ip ?? "",
    userAgent: (req.header("user-agent") ?? "").slice(0, 512),
    visitorId,
    user: req.user as User | undefined,
  };
}
