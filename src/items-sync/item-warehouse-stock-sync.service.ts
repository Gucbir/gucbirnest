// item-warehouse-stock-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

function chunkify<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@Injectable()
export class ItemWarehouseStockSyncService {
  private readonly logger = new Logger(ItemWarehouseStockSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  async syncStocks() {
    this.logger.log('SAP → PostgreSQL ItemWarehouseStock senkronu başlıyor...');

    const items = await this.prisma.item.findMany({
      select: { id: true, ItemCode: true },
    });
    const itemMap = new Map(items.map((i) => [i.ItemCode, i.id]));

    const activeWarehouses = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, WhsCode: true },
      orderBy: { WhsCode: 'asc' },
    });

    this.logger.log(
      `Map hazır: items=${items.length}, activeWarehouses=${activeWarehouses.length}`,
    );

    let totalFetched = 0;
    let totalUpserted = 0;
    let skippedNoMap = 0;

    for (const w of activeWarehouses) {
      const whsCode = String(w.WhsCode ?? '').trim();
      if (!whsCode) continue;

      this.logger.log(`[StockByWhs] whs=${whsCode} başlıyor...`);

      // 1) ilk sayfa POST ile
      const firstRes: any = await this.sap.post(
        `SQLQueries('StockByWhs')/List`,
        {
          ParamList: `whsCode='${whsCode.replace(/'/g, "''")}'`,
        },
      );

      let page = 0;
      const missingItems = new Set<string>();

      const processPage = async (rows: any[]) => {
        totalFetched += rows.length;

        const prepared = rows
          .map((r) => {
            const itemCode = String(r.ItemCode ?? '').trim();
            const itemId = itemMap.get(itemCode);
            if (!itemId) {
              skippedNoMap++;
              missingItems.add(itemCode);
              return null;
            }

            return {
              itemId,
              warehouseId: w.id,
              ItemCode: itemCode,
              WhsCode: whsCode,
              InStock: Number(r.InStock ?? 0),
              IsCommited: r.IsCommited != null ? Number(r.IsCommited) : 0,
              OnOrder: r.OnOrder != null ? Number(r.OnOrder) : 0,
            };
          })
          .filter(Boolean) as any[];

        this.logger.warn(`skippedNoMap=${skippedNoMap}`);
        if (missingItems.size) {
          this.logger.warn(
            `Missing itemCodes sample: ${Array.from(missingItems).slice(0, 20).join(', ')}`,
          );
        }
        const chunks = chunkify(prepared, 150);

        for (const ch of chunks) {
          await this.prisma.$transaction(
            ch.map((d) =>
              this.prisma.itemWarehouseStock.upsert({
                where: {
                  itemId_warehouseId: {
                    itemId: d.itemId,
                    warehouseId: d.warehouseId,
                  },
                },
                create: d,
                update: {
                  InStock: d.InStock,
                  IsCommited: d.IsCommited,
                  OnOrder: d.OnOrder,
                  ItemCode: d.ItemCode,
                  WhsCode: d.WhsCode,
                },
              }),
            ),
          );
          totalUpserted += ch.length;
        }
      };

      let rows: any[] = firstRes?.value ?? [];
      await processPage(rows);

      // ✅ nextLink ile devam
      let nextLink: string | null = firstRes?.['odata.nextLink'] ?? null;

      this.logger.log(
        `[StockByWhs] whs=${whsCode} page=${page} rows=${rows.length} next=${Boolean(nextLink)}`,
      );

      // 2) sonraki sayfalar GET ile
      while (nextLink) {
        page++;

        // nextLink relative geliyor: "SQLQueries('StockByWhs')/List?whsCode='101'&$skip=20"
        const resNext: any = await this.sap.get(nextLink); // ✅ SapService.get relative path desteklemeli

        rows = resNext?.value ?? [];
        await processPage(rows);

        nextLink = resNext?.['odata.nextLink'] ?? null;

        this.logger.log(
          `[StockByWhs] whs=${whsCode} page=${page} rows=${rows.length} next=${Boolean(nextLink)}`,
        );

        if (rows.length === 0) break; // emniyet
      }

      this.logger.log(`[StockByWhs] whs=${whsCode} bitti ✅`);
    }

    this.logger.log(
      `Stock senkron tamamlandı ✅ fetched=${totalFetched}, upserted=${totalUpserted}, skippedNoMap=${skippedNoMap}`,
    );

    return {
      fetched: totalFetched,
      upserted: totalUpserted,
      skippedNoMap,
      activeWarehouses: activeWarehouses.length,
    };
  }
}
