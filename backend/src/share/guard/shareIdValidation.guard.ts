import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { I18nService } from "nestjs-i18n";

// has to accept everything the create share validation allows, underscore included
export const isValidShareId = (id: string) => /^[a-zA-Z0-9_-]*={0,2}$/.test(id);

@Injectable()
export class IdValidation implements CanActivate {
  constructor(private readonly i18n: I18nService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    let id: string;
    try {
      id =
        request.params?.id ||
        request.query?.id ||
        request.body?.id ||
        request.params?.shareId;
    } catch {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    if (!id) {
      return true;
    }

    if (!isValidShareId(id)) {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    return true;
  }
}
