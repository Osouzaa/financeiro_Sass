import { Module } from '@nestjs/common';
import { EntryRules } from './entry-rules';

/** Regras compartilhadas por lançamentos e recorrências (contas, categorias, datas, faturas). */
@Module({
  providers: [EntryRules],
  exports: [EntryRules],
})
export class LedgerModule {}
