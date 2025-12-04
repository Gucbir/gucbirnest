import { Module } from '@nestjs/common';
import { OpenSalesOrdersController } from './open-sales-orders.controller';
import { OpenSalesOrdersService } from './open-sales-orders.service';
import { SapModule } from '../sap/sap.module';

@Module({
  imports: [SapModule],
  controllers: [OpenSalesOrdersController],
  providers: [OpenSalesOrdersService],
})
export class OpenSalesOrdersModule {}
