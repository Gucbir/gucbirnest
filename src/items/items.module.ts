import { Module } from '@nestjs/common';
import { ItemsSyncService } from '../items-sync/items-sync.service';
import { ItemWarehouseStockSyncService } from '../items-sync/item-warehouse-stock-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  controllers: [ItemsController],
  providers: [
    ItemsService,
    ItemsSyncService,
    ItemWarehouseStockSyncService,
    PrismaService,
    SapService,
  ],
  exports: [ItemsSyncService, ItemsService, ItemWarehouseStockSyncService],
})
export class ItemsModule {}
