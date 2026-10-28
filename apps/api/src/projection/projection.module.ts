import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { ProjectionController } from './projection.controller';
import { ProjectionService } from './projection.service';

@Module({
  imports: [AccountsModule, InvoicesModule, RecurrencesModule],
  controllers: [ProjectionController],
  providers: [ProjectionService],
})
export class ProjectionModule {}
