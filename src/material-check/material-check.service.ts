import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapBomService } from '../sap-bom/sap-bom.service';
import {
  CheckOrderLineMaterialDto,
  MaterialCheckResultDto,
  MaterialShortageItemDto,
} from './dto/check-order-line-material.dto';

@Injectable()
export class MaterialCheckService {
  private readonly logger = new Logger(MaterialCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapBom: SapBomService,
  ) {}

  async checkOrderLineMaterial(
    params: CheckOrderLineMaterialDto,
  ): Promise<MaterialCheckResultDto> {
    const { parentItemCode, requestedQty, fallbackWhsCode } = params;

    this.logger.log(`=== MATERIAL CHECK START ===`);
    this.logger.log(
      `Parent=${parentItemCode} Qty=${requestedQty} FallbackWhs=${fallbackWhsCode}`,
    );

    // 1) BOM çek
    const bomLines = await this.sapBom.getBomByItemCode(parentItemCode);
    console.log('BOOOOMLINESSS', bomLines);
    this.logger.log(`BOM lines count: ${bomLines.length}`);
    this.logger.debug(
      `BOM sample (first 20): ${JSON.stringify(bomLines.slice(0, 20), null, 2)}`,
    );

    if (!bomLines.length) {
      this.logger.warn(`BOM bulunamadı: ${parentItemCode}`);
      return {
        ok: false,
        shortages: [
          {
            itemCode: parentItemCode,
            whsCode: fallbackWhsCode,
            required: requestedQty,
            inStock: 0,
            missing: requestedQty,
          },
        ],
      };
    }

    // 2) ihtiyaçları grupla
    const needsMap = new Map<
      string,
      { itemCode: string; whsCode: string; required: number }
    >();

    for (const l of bomLines) {
      const itemCode = String(l.ItemCode ?? '').trim();
      if (!itemCode) continue;

      const whsCode =
        String(l.WhsCode ?? l.Warehouse ?? '').trim() || fallbackWhsCode;
      const perUnit = Number(l.Quantity ?? 0);
      const required = requestedQty * perUnit;

      const key = `${itemCode}__${whsCode}`;
      const prev = needsMap.get(key);
      if (prev) prev.required += required;
      else needsMap.set(key, { itemCode, whsCode, required });
    }

    const needs = Array.from(needsMap.values());
    // this.logger.log(`Needs grouped count: ${needs.length}`);
    // this.logger.debug(`Needs: ${JSON.stringify(needs, null, 2)}`);

    // 3) PSQL stokları çek
    const stocks = await this.prisma.itemWarehouseStock.findMany({
      where: {
        OR: needs.map((n) => ({ ItemCode: n.itemCode, WhsCode: n.whsCode })),
      },
      select: { ItemCode: true, WhsCode: true, InStock: true, updatedAt: true },
    });

    // this.logger.log(`PSQL stocks found: ${stocks.length}`);
    // this.logger.debug(`Stocks: ${JSON.stringify(stocks, null, 2)}`);

    const stockMap = new Map(
      stocks.map((s) => [
        `${s.ItemCode}__${s.WhsCode}`,
        Number(s.InStock ?? 0),
      ]),
    );

    // 4) eksikleri hesapla
    const shortages: MaterialShortageItemDto[] = needs
      .map((n) => {
        const inStock = stockMap.get(`${n.itemCode}__${n.whsCode}`) ?? 0;
        const missing = n.required - inStock;

        return {
          itemCode: n.itemCode,
          whsCode: n.whsCode,
          required: n.required,
          inStock,
          missing: missing > 0 ? missing : 0,
        };
      })
      .filter((x) => x.missing > 0);
    if (shortages.length) {
      const codes = [...new Set(shortages.map((s) => s.itemCode))];

      const items = await this.prisma.item.findMany({
        where: { ItemCode: { in: codes } },
        select: { ItemCode: true, ItemName: true },
      });
      this.logger.log(`[MaterialCheck] Item lookup count=${items.length}`);

      const nameMap = new Map(items.map((i) => [i.ItemCode, i.ItemName]));

      for (const s of shortages) {
        s.itemName = nameMap.get(s.itemCode) ?? undefined;
      }
    }
    // ✅ 5.* eksiklerin alt eksiklerini de getir (1 seviye)
    const subParents = shortages.filter((s) =>
      String(s.itemCode).startsWith('5.'),
    );
    if (subParents.length) {
      await Promise.all(
        subParents.map(async (p) => {
          try {
            // kritik: alt BOM ihtiyacı, parent’ın "missing" miktarı kadar hesaplanır
            const childShortages = await this.computeShortagesForItem({
              parentItemCode: p.itemCode,
              requestedQty: p.missing, // 👈 eksik kaç adetse o kadar alt ihtiyaç
              fallbackWhsCode: p.whsCode || fallbackWhsCode,
            });

            p.children = childShortages;
          } catch {
            p.children = [];
          }
        }),
      );
    }

    this.logger.log(`Shortages count: ${shortages.length}`);
    if (shortages.length)
      this.logger.warn(`Shortages: ${JSON.stringify(shortages, null, 2)}`);

    this.logger.log(`=== MATERIAL CHECK END === ok=${shortages.length === 0}`);

    return { ok: shortages.length === 0, shortages };
  }

  private async computeShortagesForItem(params: {
    parentItemCode: string;
    requestedQty: number;
    fallbackWhsCode: string;
  }): Promise<MaterialShortageItemDto[]> {
    const { parentItemCode, requestedQty, fallbackWhsCode } = params;

    const bomLines = await this.sapBom.getBomByItemCode(parentItemCode);
    if (!bomLines?.length) return [];

    // ihtiyaç grupla
    const needsMap = new Map<
      string,
      { itemCode: string; whsCode: string; required: number }
    >();

    for (const l of bomLines) {
      const itemCode = String(l.ItemCode ?? '').trim();
      if (!itemCode) continue;

      const whsCode =
        String(l.WhsCode ?? l.Warehouse ?? '').trim() || fallbackWhsCode;
      const perUnit = Number(l.Quantity ?? 0);
      const required = requestedQty * perUnit;

      const key = `${itemCode}__${whsCode}`;
      const prev = needsMap.get(key);
      if (prev) prev.required += required;
      else needsMap.set(key, { itemCode, whsCode, required });
    }

    const needs = Array.from(needsMap.values());

    // stokları çek
    const stocks = await this.prisma.itemWarehouseStock.findMany({
      where: {
        OR: needs.map((n) => ({ ItemCode: n.itemCode, WhsCode: n.whsCode })),
      },
      select: { ItemCode: true, WhsCode: true, InStock: true },
    });

    const stockMap = new Map(
      stocks.map((s) => [
        `${s.ItemCode}__${s.WhsCode}`,
        Number(s.InStock ?? 0),
      ]),
    );

    // alt eksikleri üret
    const shortages: MaterialShortageItemDto[] = needs
      .map((n) => {
        const inStock = stockMap.get(`${n.itemCode}__${n.whsCode}`) ?? 0;
        const missing = n.required - inStock;
        return {
          itemCode: n.itemCode,
          whsCode: n.whsCode,
          required: n.required,
          inStock,
          missing: missing > 0 ? missing : 0,
        };
      })
      .filter((x) => x.missing > 0);
    if (shortages.length) {
      const codes = [...new Set(shortages.map((s) => s.itemCode))];
      const items = await this.prisma.item.findMany({
        where: { ItemCode: { in: codes } },
        select: { ItemCode: true, ItemName: true },
      });
      const nameMap = new Map(items.map((i) => [i.ItemCode, i.ItemName]));

      for (const s of shortages) {
        s.itemName = nameMap.get(s.itemCode) ?? undefined;
      }
    }

    return shortages;
  }
}
