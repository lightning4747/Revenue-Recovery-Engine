import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { OpportunityQueryDto } from './dto/opportunity-query.dto';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: any) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.getSummary(merchantId);
  }

  @Get('opportunities')
  async getOpportunities(
    @Req() req: any,
    @Query() query: OpportunityQueryDto,
  ) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.getOpportunities(merchantId, query);
  }

  @Get('opportunities/:id')
  async getOpportunityById(@Req() req: any, @Param('id') id: string) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.getOpportunityById(merchantId, id);
  }

  @Get('audit-trail/:id')
  async getAuditTrail(@Req() req: any, @Param('id') id: string) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.getAuditTrail(merchantId, id);
  }

  @Post('opportunities/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveOpportunity(@Req() req: any, @Param('id') id: string) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.approveOpportunity(merchantId, id);
  }

  @Post('opportunities/:id/recover')
  @HttpCode(HttpStatus.OK)
  async triggerRecovery(@Req() req: any, @Param('id') id: string) {
    const merchantId = req.user.merchantId;
    return this.dashboardService.triggerRecovery(merchantId, id);
  }
}
