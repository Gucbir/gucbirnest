import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { MaterialCheckModule } from '../material-check/material-check.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { SapModule } from '../sap/sap.module'; // ✅
import { SapBomModule } from '../sap-bom/sap-bom.module';
import { ItemsModule } from 'src/items/items.module';
import { SapBomService } from 'src/sap-bom/sap-bom.service';
@Module({
  imports: [
    SapModule,
    ItemsModule,
    MaterialCheckModule,
    ProcurementModule,
    SapBomModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService, SapBomService],
})
export class ProductionModule {} // 🔥 BU SATIR ŞART
