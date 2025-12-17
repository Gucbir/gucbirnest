// src/stocks/stocks.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Controller('stocks')
export class StocksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  /**
   * Depo bazlı stok + item bilgisi (PSQL)
   * GET /stocks/warehouses/:whsCode/items
   * Opsiyon: ?onlyPositive=false (0 stokları da getir)
   */
  @Get('warehouses/:whsCode/items')
  async getItemsByWarehouse(
    @Param('whsCode') whsCode: string,
    @Query('onlyPositive') onlyPositive?: string,
  ) {
    const onlyPos = onlyPositive !== 'false'; // default true

    // 1) SAP’ten ilgili deponun stoklarını çek
    const sapRows: any[] = await this.sap.getWarehouseStocks(whsCode);
    // Örn: [{ ItemCode, WhsCode, InStock, IsCommited, OnOrder }, ...]

    // 2) Normalize + filtre (stok > 0)
    const normalized = (sapRows ?? []).map((r) => ({
      ItemCode: String(r.ItemCode ?? '').trim(),
      WhsCode: String(r.WhsCode ?? whsCode).trim(),
      InStock: Number(r.InStock ?? 0),
      IsCommited: r.IsCommited == null ? null : Number(r.IsCommited),
      OnOrder: r.OnOrder == null ? null : Number(r.OnOrder),
    }));

    const filtered = onlyPos
      ? normalized.filter((r) => r.ItemCode && r.InStock > 0)
      : normalized.filter((r) => r.ItemCode);

    if (filtered.length === 0) return [];

    // 3) Unique itemCodes
    const itemCodes = [...new Set(filtered.map((r) => r.ItemCode))];

    // 4) PostgreSQL’den Item tablosunu çek (sadece gerekli alanlar)
    const items = await this.prisma.item.findMany({
      where: { ItemCode: { in: itemCodes } },
      select: {
        id: true,
        ItemCode: true,
        ItemName: true,
        ForeignName: true,
        ItemsGroupCode: true,
        ItemType: true,
        InventoryItem: true,
        SalesItem: true,
        PurchaseItem: true,
      },
    });

    const itemMap = new Map(items.map((i) => [i.ItemCode.trim(), i]));

    // 5) Merge: Item + stok bilgisi
    return filtered.map((row) => {
      const base = itemMap.get(row.ItemCode);

      return {
        // SAP (stok)
        ItemCode: row.ItemCode,
        WhsCode: row.WhsCode,
        InStock: row.InStock,
        IsCommited: row.IsCommited,
        OnOrder: row.OnOrder,

        // PSQL (item)
        itemId: base?.id ?? null,
        ItemName: base?.ItemName ?? null,
        ForeignName: base?.ForeignName ?? null,
        ItemsGroupCode: base?.ItemsGroupCode ?? null,
        ItemType: base?.ItemType ?? null,
        InventoryItem: base?.InventoryItem ?? null,
        SalesItem: base?.SalesItem ?? null,
        PurchaseItem: base?.PurchaseItem ?? null,

        // debug: DB’de bulunamadı mı?
        itemExistsInDb: Boolean(base),
      };
    });
  }
}
