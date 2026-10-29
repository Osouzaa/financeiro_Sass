import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesService } from './recurrences.service';

@Module({
  imports: [LedgerModule],
  controllers: [RecurrencesController],
  providers: [RecurrencesService],
  exports: [RecurrencesService],
})
export class RecurrencesModule {}
