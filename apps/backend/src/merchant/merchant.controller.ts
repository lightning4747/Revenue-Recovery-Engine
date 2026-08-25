import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';
import { MerchantService } from './merchant.service';

@Controller('api/v1/merchant')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Put('credentials')
  async updateCredentials(
    @CurrentMerchant() merchantId: string,
    @Body() dto: UpdateCredentialsDto,
  ) {
    return this.merchantService.updateCredentials(merchantId, dto);
  }

  @Get('credentials')
  async getCredentials(@CurrentMerchant() merchantId: string) {
    return this.merchantService.getCredentialMetadata(merchantId);
  }
}
