import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { SapModule } from '../sap/sap.module'; // path’i projenin yapısına göre düzelt

@Module({
  imports: [SapModule],        // <<< BUNU EKLE
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
