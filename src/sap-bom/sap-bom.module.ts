import { Module } from '@nestjs/common';
import { SapBomService } from './sap-bom.service';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [SapModule],
  providers: [SapBomService],
  exports: [SapBomService],
})
export class SapBomModule {}
