import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { AppConfig } from '../config/app-config';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfig) {
    super({
      adapter: new PrismaMssql(config.databaseUrl),
      // O padrão (5 s) é curto para operações em lote, como gerar uma recorrência
      // semanal de anos ou uma compra em 120x; acima disso a transação é desfeita
      transactionOptions: { maxWait: 5_000, timeout: 20_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao SQL Server');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
