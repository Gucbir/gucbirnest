import { Controller, Get } from '@nestjs/common';
import { ItemsService } from './items.service';

@Controller('sap/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('form-options')
  async getFormOptions() {
    // C#’taki `[Route("api/SAP/[controller]/form-options")]`'ın Nest karşılığı
    return this.itemsService.getFormOptions();
  }

  @Get('groups')
  async getGroups() {
    return this.itemsService.getItemGroups();
  }

  @Get('warehouses')
  async getWarehouses() {
    return this.itemsService.getWarehouses();
  }
}
