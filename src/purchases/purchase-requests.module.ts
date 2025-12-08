// src/purchase-requests/purchase-requests.module.ts
import { Module } from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { SapModule } from '../sap/sap.module'; // SapService burada ise

@Module({
  imports: [SapModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
