import { Module } from '@nestjs/common';
import { SapService } from './sap.service';
import { SapController } from './sap.controller';

@Module({
  providers: [SapService],
  controllers: [SapController],
  exports: [SapService],
})
export class SapModule {}
