// src/stocks/stocks.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Controller('stocks')
export class StocksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  @Get('warehouses/:whsCode/items')
  async getItemsByWarehouse(@Param('whsCode') whsCode: string) {
    // 1) SAP’ten ilgili deponun stoklarını çek
    const sapRows: any[] = await this.sap.getWarehouseStocks(whsCode);
    // Örn: [{ ItemCode: 'ABC', WhsCode: '101', InStock: 12, ... }, ...]
    console.log(sapRows, 'sdfsdfsdf');
    // 2) Sadece stok > 0 olanları al (istenirse)
    const filtered = sapRows.filter((r) => Number(r.InStock) > 0);

    const itemCodes = filtered.map((r) => r.ItemCode);
    if (itemCodes.length === 0) return [];

    // 3) PostgreSQL’den Item tablosunu çek
    const items = await this.prisma.item.findMany({
      where: {
        ItemCode: { in: itemCodes },
      },
    });

    const itemMap = new Map(items.map((i) => [i.ItemCode, i]));

    // 4) Merge: Item + stok bilgisi
    return filtered.map((row) => {
      const base = itemMap.get(row.ItemCode);
      return {
        ItemCode: row.ItemCode,
        WhsCode: row.WhsCode,
        InStock: Number(row.InStock) || 0,
        // SAP’ten gelen stok
        // PostgreSQL’deki item bilgisi
        ItemName: base?.ItemName ?? null,
        ForeignName: base?.ForeignName ?? null,
        ItemsGroupCode: base?.ItemsGroupCode ?? null,
        // vs istediğin alanlar
      };
    });
  }
}
