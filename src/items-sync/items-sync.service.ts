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

  async syncAllItems() {
    this.logger.log('SAP → PostgreSQL Item senkronu başlıyor...');

    // ✅ 1) önce item gruplarını senkronla
    const groupsResult = await this.syncAllItemGroups();
    this.logger.log(
      `ItemGroups sync ✅ fetched=${groupsResult.fetched} upserted=${groupsResult.upserted}`,
    );

    // ✅ 2) sonra item'ları çek
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

    this.logger.log(`Item senkron tamamlandı ✅ ${updated} kayıt işlendi.`);
    return { updated, itemGroups: groupsResult };
  }

  /**
   * Service Layer'dan sayfa sayfa tüm Items çeker
   */
  private async fetchAllSapItems() {
    const pageSize = 1000;
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
      // ✅ UDF
      'U_DG_ALTERNMODEL',
      'U_DG_MARKA',
    ].join(',');

    while (true) {
      const res: any = await this.sap.get('Items', {
        params: { $select: selectFields, $top: pageSize, $skip: skip },
      });

      const page: any[] = res?.value || [];
      this.logger.log(`SAP Items page skip=${skip}, çekilen=${page.length}`);
      if (page.length === 0) break;

      all.push(...page);
      skip += page.length;
    }

    // ✅ artık DB’de gruplar var -> id map
    const groupIdMap = await this.getItemGroupIdMap();

    const mapped = all.map((s) => {
      const grpCode =
        s.ItemsGroupCode != null ? Number(s.ItemsGroupCode) : null;

      return {
        ItemCode: s.ItemCode,
        ItemName: s.ItemName,
        ForeignName: s.ForeignName,

        ItemType: s.ItemType,

        // ✅ relation
        itemGroupId: grpCode != null ? (groupIdMap.get(grpCode) ?? null) : null,

        InventoryItem: s.InventoryItem === 'tYES',
        SalesItem: s.SalesItem === 'tYES',
        PurchaseItem: s.PurchaseItem === 'tYES',

        InventoryUoM: s.InventoryUOM || null,
        SalesUoM: s.SalesUnit || null,
        PurchaseUoM: s.PurchaseUnit || null,

        MinInventory: s.MinInventory ?? null,
        MaxInventory: s.MaxInventory ?? null,
        QuantityOnStock: s.QuantityOnStock ?? 0,

        Valid: s.Valid === 'tYES',
        Frozen: s.Frozen === 'tYES',
        AssetItem: s.AssetItem === 'tYES',

        AlternatorModel: s.U_DG_ALTERNMODEL ?? null,
        Marka: s.U_DG_MARKA ?? null,
      };
    });

    return mapped.filter((x) => x.ItemName && x.ItemName.trim() !== '');
  }

  /**
   * SAP ItemGroups -> DB upsert
   * CLI’dan da çağırabileceğin public metod
   */
  async syncAllItemGroups() {
    const pageSize = 200;
    let skip = 0;

    let fetched = 0;
    let upserted = 0;

    while (true) {
      const res: any = await this.sap.get('ItemGroups', {
        params: { $select: 'Number,GroupName', $top: pageSize, $skip: skip },
      });

      const page: any[] = res?.value ?? [];
      this.logger.log(
        `SAP ItemGroups page skip=${skip}, çekilen=${page.length}`,
      );

      if (page.length === 0) break;

      fetched += page.length;

      for (const g of page) {
        const code = Number(g.Number);
        const name = String(g.GroupName ?? '').trim();
        if (!code || Number.isNaN(code) || !name) continue;

        await this.prisma.itemGroup.upsert({
          where: { code },
          update: { name },
          create: { code, name },
        });

        upserted++;
      }

      skip += page.length;
    }

    return { fetched, upserted };
  }

  private async getItemGroupIdMap(): Promise<Map<number, number>> {
    const groups = await this.prisma.itemGroup.findMany({
      select: { id: true, code: true },
    });

    const map = new Map<number, number>();
    for (const g of groups) map.set(g.code, g.id);
    return map;
  }
}
