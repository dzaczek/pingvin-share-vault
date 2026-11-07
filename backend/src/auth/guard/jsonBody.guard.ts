import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

// The routes that hand out session cookies only take JSON. A page on another
// site can make the browser post a plain HTML form here without asking, and
// Express parses form bodies too, so that form could sign the visitor into an
// account the other site controls. Sending JSON from another site needs a CORS
// preflight, which this app never answers.
@Injectable()
export class JsonBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const contentType = `${context.switchToHttp().getRequest().headers?.["content-type"] ?? ""}`;
    if (contentType.split(";")[0].trim().toLowerCase() === "application/json")
      return true;
    throw new UnsupportedMediaTypeException("Send the request as JSON");
  }
}
