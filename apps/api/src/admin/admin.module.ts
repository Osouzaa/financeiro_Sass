import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
})
export class AdminModule {}
