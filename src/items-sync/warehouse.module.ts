import { Module } from '@nestjs/common';
import { WarehouseSyncService } from './warehouse-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Module({
  providers: [WarehouseSyncService, PrismaService, SapService],
  exports: [WarehouseSyncService],
})
export class WarehouseModule {}
