import { Module } from '@nestjs/common';
import { ItemsSyncService } from './items-sync.service';
import { ItemsSyncController } from './items-sync.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Module({
  controllers: [ItemsSyncController],
  providers: [ItemsSyncService, PrismaService, SapService],
})
export class ItemsSyncModule {}
