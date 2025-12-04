import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

interface SapWarehouseStock {
  ItemCode: string;
  WhsCode: string;
  InStock: number;
  IsCommited?: number;
  OnOrder?: number;
}

@Injectable()
export class ItemStockSyncService {
  private readonly logger = new Logger(ItemStockSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  /**
   * Belirli bir depo için stok senkronu
   * Örn: yarn control stock:sync R1
   */
  async syncWarehouseStocks(whsCode: string) {
    this.logger.log(`SAP → PostgreSQL stok senkronu başlıyor. Depo=${whsCode}`);

    // 1) SAP'ten stokları al
    const sapStocks = await this.fetchSapStocksForWarehouse(whsCode);
    this.logger.log(
      `SAP'ten depo=${whsCode} için ${sapStocks.length} stok kaydı geldi.`,
    );

    // 2) Mevcut kayıtları (ilgili depo için) sil
    await this.prisma.itemWarehouseStock.deleteMany({
      where: { WhsCode: whsCode },
    });

    // 3) Upsert mantığı ile yeni kayıtları yaz
    let created = 0;
    for (const s of sapStocks) {
      // İlgili Item'ı bul (ItemCode'a göre)
      const item = await this.prisma.item.findUnique({
        where: { ItemCode: s.ItemCode },
        select: { id: true },
      });

      if (!item) {
        // Item tablosunda yoksa şimdilik atla
        this.logger.warn(
          `Depo=${whsCode} için stok kaydı atlandı; ItemCode=${s.ItemCode} Item tablosunda yok.`,
        );
        continue;
      }

      // Warehouse kaydını bul / oluştur
      const warehouse = await this.prisma.warehouse.upsert({
        where: { WhsCode: s.WhsCode },
        create: {
          WhsCode: s.WhsCode,
          WhsName: s.WhsCode, // İleride gerçek isimle güncellersin
        },
        update: {},
      });

      await this.prisma.itemWarehouseStock.upsert({
        where: {
          itemId_warehouseId: {
            itemId: item.id,
            warehouseId: warehouse.id,
          },
        },
        update: {
          ItemCode: s.ItemCode,
          WhsCode: s.WhsCode,
          InStock: s.InStock,
          IsCommited: s.IsCommited ?? null,
          OnOrder: s.OnOrder ?? null,
        },
        create: {
          itemId: item.id,
          warehouseId: warehouse.id,
          ItemCode: s.ItemCode,
          WhsCode: s.WhsCode,
          InStock: s.InStock,
          IsCommited: s.IsCommited ?? null,
          OnOrder: s.OnOrder ?? null,
        },
      });

      created++;
    }

    this.logger.log(
      `Depo=${whsCode} stok senkron tamamlandı ✅ ${created} kayıt eklendi/güncellendi.`,
    );

    return { whsCode, count: created };
  }

  /**
   * 🔴 Buradaki implementasyonu SAP tarafına göre dolduracağız.
   * Şimdilik mock / TODO bırakıyorum.
   */
  private async fetchSapStocksForWarehouse(
    whsCode: string,
  ): Promise<SapWarehouseStock[]> {
    // 1) En sağlıklısı: SAP Query Manager'da bir SQL Query kaydet:
    //   SELECT
    //     T0."ItemCode",
    //     T0."WhsCode",
    //     T0."OnHand"    AS "InStock",
    //     T0."IsCommited",
    //     T0."OnOrder"
    //   FROM OITW T0
    //   WHERE T0."WhsCode" = /* WhsCode */ '[%0]'
    //
    // 2) Bu Query'ye bir kod ver (ör: Z_ITEM_STOCK_BY_WHS)
    // 3) Service Layer'da SQLQueries endpoint'i ile çağır:
    //
    // ÖRNEK pseudo-code (SapService tarafında bu fonksiyonu yazabilirsin):
    //
    // const res = await this.sap.callSqlQuery('Z_ITEM_STOCK_BY_WHS', [whsCode]);

    // Şimdilik TODO:
    const res: any = await this.sap.get('SQLQueries', {
      // Bu kısım SAP versiyonuna göre değişecek;
      // sadece imza / yapı için placeholder.
      params: {},
    });

    // TODO: res.value içindeki alan isimlerini kendi Query'ine göre map et
    const stocks: SapWarehouseStock[] = (res.value || []).map((row: any) => ({
      ItemCode: row.ItemCode,
      WhsCode: row.WhsCode,
      InStock: row.InStock,
      IsCommited: row.IsCommited,
      OnOrder: row.OnOrder,
    }));

    return stocks;
  }
}
