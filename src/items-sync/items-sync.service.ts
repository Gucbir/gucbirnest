// src/items/items-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Injectable()
export class ItemsSyncService {
  private readonly logger = new Logger(ItemsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  /**
   * Dışarıdan çağıracağın ana fonksiyon
   * POST /api/items/sync bunu tetikleyecek
   */
  async syncAllItems() {
    this.logger.log('SAP → PostgreSQL Item senkronu başlıyor...');

    const sapItems = await this.fetchAllSapItems();
    this.logger.log(`SAP'ten toplam ${sapItems.length} item geldi.`);

    let updated = 0;

    for (const item of sapItems) {
      await this.prisma.item.upsert({
        where: { ItemCode: item.ItemCode },
        update: item,
        create: item,
      });
      updated++;
    }

    this.logger.log(
      `Item senkron tamamlandı ✅ ${updated} kayıt eklendi/güncellendi.`,
    );

    return { updated };
  }

  /**
   * Service Layer'dan sayfa sayfa tüm Items çeker
   */
  private async fetchAllSapItems() {
    const pageSize = 1000; // istersen 1000 bırak, istersen 300
    let skip = 0;
    const all: any[] = [];

    const selectFields = [
      'ItemCode',
      'ItemName',
      'ForeignName',
      'ItemType',
      'ItemsGroupCode',
      'InventoryItem',
      'SalesItem',
      'PurchaseItem',
      'InventoryUOM',
      'SalesUnit',
      'PurchaseUnit',
      'MinInventory',
      'MaxInventory',
      'Valid',
      'Frozen',
      'AssetItem',
      'QuantityOnStock',
    ].join(',');

    while (true) {
      const res: any = await this.sap.get('Items', {
        params: {
          $select: selectFields,
          $top: pageSize,
          $skip: skip,
        },
      });

      const page: any[] = res?.value || [];
      this.logger.log(`SAP Items page skip=${skip}, çekilen=${page.length}`);

      // Hiç kayıt gelmediyse gerçekten son sayfaya gelmişizdir
      if (page.length === 0) {
        break;
      }

      all.push(...page);

      // Sonraki sayfa için, gerçekten gelen kayıt sayısı kadar atla
      skip += page.length;
      // İstersen güvenlik için hard limit koyabilirsin:
      // if (all.length > 50000) break;
    }

    const mapped = all.map((s) => ({
      ItemCode: s.ItemCode,
      ItemName: s.ItemName,
      ForeignName: s.ForeignName,
      ItemType: s.ItemType,
      ItemsGroupCode: s.ItemsGroupCode,

      InventoryItem: s.InventoryItem === 'tYES',
      SalesItem: s.SalesItem === 'tYES',
      PurchaseItem: s.PurchaseItem === 'tYES',

      InventoryUoM: s.InventoryUOM || s.InventoryUoM || null,
      SalesUoM: s.SalesUnit || null,
      PurchaseUoM: s.PurchaseUnit || null,

      MinInventory: s.MinInventory,
      MaxInventory: s.MaxInventory,
      QuantityOnStock: s.QuantityOnStock ?? 0,
      Valid: s.Valid === 'tYES',
      Frozen: s.Frozen === 'tYES',
      AssetItem: s.AssetItem === 'tYES',

      AvgPrice: null,
      LastPurPrc: null,
      LastPurCur: null,
    }));
    console.log(mapped);
    return mapped.filter((x) => x.ItemName && x.ItemName.trim() !== '');
  }
}
