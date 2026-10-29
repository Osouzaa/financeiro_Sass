import { Module } from '@nestjs/common';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [RecurrencesModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
