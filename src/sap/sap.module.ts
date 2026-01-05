import { Module } from '@nestjs/common';
import { SapService } from './sap.service';
import { SapController } from './sap.controller';
import { SapSerialsService } from './sap-serials.service';

@Module({
  providers: [SapService, SapSerialsService],
  controllers: [SapController],
  exports: [SapService],
})
export class SapModule {}
