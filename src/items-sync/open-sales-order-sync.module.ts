import { Module } from '@nestjs/common';
import { OpenSalesOrderSyncService } from './items-stocks-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [PrismaModule, SapModule],
  providers: [OpenSalesOrderSyncService],
  exports: [OpenSalesOrderSyncService],
})
export class OpenSalesOrderSyncModule {}
