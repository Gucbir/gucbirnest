import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { MaterialCheckModule } from '../material-check/material-check.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { SapModule } from '../sap/sap.module'; // ✅

@Module({
  imports: [SapModule, MaterialCheckModule, ProcurementModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {} // 🔥 BU SATIR ŞART
