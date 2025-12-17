import { Controller, Get, Param } from '@nestjs/common';
import { OpenSalesOrdersService } from './open-sales-orders.service';

@Controller('open-orders')
export class OpenSalesOrdersController {
  constructor(private readonly svc: OpenSalesOrdersService) {}

  // 🔹 Liste
  @Get()
  async all() {
    return this.svc.getOpenOrders();
  }

  // 🔹 Akordiyon Detay (kalemler + açıklama)
  @Get(':docEntry/lines')
  getOrderLines(@Param('docEntry') docEntry: string) {
    return this.svc.getOrderLines(Number(docEntry));
  }
}
