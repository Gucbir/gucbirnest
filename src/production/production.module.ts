import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, PrismaService, SapService],
  exports: [ProductionService],
})
export class ProductionModule {}
