import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles('ADMIN')
  getAdminDashboard() {
    return this.dashboardService.getAdminMetrics();
  }

  @Get('technician')
  @Roles('TECHNICIAN', 'ADMIN')
  getTechnicianDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getTechnicianMetrics(userId);
  }

  @Get('me')
  @Roles('END_USER')
  getEndUserDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getEndUserMetrics(userId);
  }
}
