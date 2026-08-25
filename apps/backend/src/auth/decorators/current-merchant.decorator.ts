import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentMerchant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.merchantId || request.user?.merchantId;
  },
);
