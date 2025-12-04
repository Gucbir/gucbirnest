import { Controller, Get } from '@nestjs/common';
import { OpenSalesOrdersService } from './open-sales-orders.service';

@Controller('open-orders')
export class OpenSalesOrdersController {
  constructor(private readonly svc: OpenSalesOrdersService) {}

  @Get()
  async all() {
    return this.svc.getOpenOrders();
  }
}
