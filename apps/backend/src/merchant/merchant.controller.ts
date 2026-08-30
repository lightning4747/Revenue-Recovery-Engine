import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
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

  @Get('policy')
  async getPolicy(@CurrentMerchant() merchantId: string) {
    return this.merchantService.getPolicy(merchantId);
  }

  @Patch('policy')
  async updatePolicy(
    @CurrentMerchant() merchantId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.merchantService.updatePolicy(merchantId, dto);
  }
}
