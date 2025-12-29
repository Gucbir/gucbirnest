import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcurementController } from './procurement.controller';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [PrismaModule, ItemsModule],
  providers: [ProcurementService],
  controllers: [ProcurementController],
  exports: [ProcurementService],
})
export class ProcurementModule {}
