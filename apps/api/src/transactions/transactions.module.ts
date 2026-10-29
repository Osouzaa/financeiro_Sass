import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [LedgerModule, RecurrencesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
