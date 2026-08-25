import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const merchantId = request.user?.merchantId;

    if (!merchantId) {
      throw new UnauthorizedException('Tenant context missing from authentication');
    }

    request.merchantId = merchantId;
    return true;
  }
}
