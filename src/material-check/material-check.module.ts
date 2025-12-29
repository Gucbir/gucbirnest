import { Module } from '@nestjs/common';
import { MaterialCheckService } from './material-check.service';
import { SapBomModule } from '../sap-bom/sap-bom.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, SapBomModule],
  providers: [MaterialCheckService],
  exports: [MaterialCheckService],
})
export class MaterialCheckModule {}
