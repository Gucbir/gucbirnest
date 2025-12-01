import { Controller, Post, Get } from '@nestjs/common';
import { ItemsSyncService } from './items-sync.service';

@Controller('items')
export class ItemsSyncController {
  constructor(private readonly itemsSyncService: ItemsSyncService) {}

  // POST /api/items/sync
  @Post('sync')
  async syncPost() {
    return this.itemsSyncService.syncAllItems();
  }

  // GET /api/items/sync  → tarayıcıdan çağırmak için
  @Get('sync')
  async syncGet() {
    return this.itemsSyncService.syncAllItems();
  }
}
