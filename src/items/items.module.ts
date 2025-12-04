import { Module } from '@nestjs/common';
import { ItemsSyncService } from '../items-sync/items-sync.service';
import { ItemStockSyncService } from '../items-sync/item-stock-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  controllers: [ItemsController],
  providers: [
    ItemsService,
    ItemsSyncService,
    ItemStockSyncService,
    PrismaService,
    SapService,
  ],
  exports: [ItemsSyncService, ItemStockSyncService],
})
export class ItemsModule {}
