import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MercadoPagoClient } from './mercadopago.client';

@Module({
  controllers: [BillingController],
  providers: [BillingService, MercadoPagoClient],
  exports: [BillingService],
})
export class BillingModule {}
