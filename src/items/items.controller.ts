import { Controller, Get, Query, Param } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsQueryDto } from './dto/items-query.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async findAll(@Query() query: ItemsQueryDto) {
    return this.itemsService.findAll(query);
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.itemsService.getFilterOptions();
  }

  @Get(':itemCode/warehouses-live')
  async getWarehousesLive(@Param('itemCode') itemCode) {
    const data =
      await this.itemsService.getWarehouseStockFromSapByItemCode(itemCode);
    return { data };
  }
}
