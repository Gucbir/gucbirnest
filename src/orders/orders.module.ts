// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [SapModule],              // <<< BUNU EKLE
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
