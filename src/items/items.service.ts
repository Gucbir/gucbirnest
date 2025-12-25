import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// Prisma tipini sadece where/orderBy için kullanıyoruz, istersen kaldırıp hepsini any yaparız.
import { Prisma } from '@prisma/client';
import { ItemsQueryDto } from './dto/items-query.dto';
import { SapService } from '../sap/sap.service';
@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapService: SapService,
  ) {} // prisma hatası böyle çözülüyor

  async findAll(query: ItemsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      itemType,
      inventoryItem,
      salesItem,
      purchaseItem,
      valid,
      frozen,
      assetItem,
      groupCode,
      hasStock,
      orderBy = 'ItemCode',
      orderDir = 'asc',
    } = query as any;

    // TIP TRUCU 1: where'i boş obje değil, tipli bir obje yapıyoruz
    const where: Prisma.ItemWhereInput = {};

    // Arama (ItemCode, ItemName, ForeignName)
    if (search && search.trim() !== '') {
      where.OR = [
        { ItemCode: { contains: search, mode: 'insensitive' } },
        { ItemName: { contains: search, mode: 'insensitive' } },
        { ForeignName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Temel filtreler
    if (itemType) {
      where.ItemType = itemType;
    }

    if (inventoryItem !== undefined) {
      where.InventoryItem = inventoryItem === 'true';
    }

    if (salesItem !== undefined) {
      where.SalesItem = salesItem === 'true';
    }

    if (purchaseItem !== undefined) {
      where.PurchaseItem = purchaseItem === 'true';
    }

    if (valid !== undefined) {
      where.Valid = valid === 'true';
    }

    if (frozen !== undefined) {
      where.Frozen = frozen === 'true';
    }

    if (assetItem !== undefined) {
      where.AssetItem = assetItem === 'true';
    }

    if (groupCode !== undefined) {
      where.ItemsGroupCode = groupCode;
    }

    // Stoklu ürün
    if (hasStock !== undefined) {
      const flag = hasStock === 'true';
      if (flag) {
        where.QuantityOnStock = { gt: 0 };
      } else {
        where.QuantityOnStock = { lte: 0 };
      }
    }

    // TIP TRUCU 2: dynamic key için any cast
    const orderByClause: Prisma.ItemOrderByWithRelationInput = {};
    (orderByClause as any)[orderBy] = orderDir || 'asc';

    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        orderBy: orderByClause,
        skip,
        take,
        // include: { warehouseStocks: true }, // depoları da istersen açarsın
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getWarehouseStockFromSapByItemCode(itemCode) {
    const rows =
      await this.sapService.getWarehouseStockFromSapByItemCode(itemCode);

    // Frontend için hafif normalize edelim
    return rows.map((row, index) => ({
      id: index + 1,
      ItemCode: row.ItemCode,
      WhsCode: row.WhsCode,
      InStock: row.InStock ?? 0,
      IsCommited: row.IsCommited ?? 0,
      OnOrder: row.OnOrder ?? 0,
    }));
  }
  private norm(code: string) {
    return String(code ?? '').trim();
  }

  private escapeODataString(v: string) {
    // OData string literal içinde tek tırnak kaçırma
    return v.replace(/'/g, "''");
  }
  async getItemNames(itemCodes: string[]): Promise<Map<string, string>> {
    const clean = [
      ...new Set(itemCodes.map((x) => this.norm(x)).filter(Boolean)),
    ];
    const map = new Map<string, string>();
    if (!clean.length) return map;

    const CHUNK = 25;

    for (let i = 0; i < clean.length; i += CHUNK) {
      const part = clean.slice(i, i + CHUNK);

      // 1) Toplu dene
      const filter = part
        .map((code) => `ItemCode eq '${this.escapeODataString(code)}'`)
        .join(' or ');

      try {
        const res: any = await this.sapService.get('Items', {
          params: {
            $select: 'ItemCode,ItemName',
            $filter: filter,
            $top: part.length,
          },
        });

        const rows: any[] = res?.value ?? [];
        for (const r of rows) {
          const c = this.norm(r?.ItemCode);
          const n = this.norm(r?.ItemName);
          if (c && n) map.set(c, n);
        }
      } catch (e) {
        this.logger.warn(
          `[getItemNames] bulk chunk failed: ${e?.message ?? e}`,
        );
      }

      // 2) Eksik kalanları tek tek garanti çek (Items('code'))
      const missingInChunk = part.filter((c) => !map.has(c));
      if (missingInChunk.length) {
        this.logger.warn(
          `[getItemNames] bulk missed ${missingInChunk.length} codes. Fallback to single fetch. sample=${missingInChunk.slice(0, 5).join(',')}`,
        );
      }

      for (const code of missingInChunk) {
        try {
          // Service Layer entity key kullanımı: Items('ItemCode')
          const key = this.escapeODataString(code);
          const one: any = await this.sapService.get(`Items('${key}')`, {
            params: { $select: 'ItemCode,ItemName' },
          });

          const c = this.norm(one?.ItemCode ?? code);
          const n = this.norm(one?.ItemName ?? '');
          if (c && n) map.set(c, n);
        } catch (e) {
          this.logger.warn(
            `[getItemNames] single miss code=${code} err=${e?.message ?? e}`,
          );
        }
      }
    }

    // Debug: hala bulunamayanlar
    const stillMissing = clean.filter((c) => !map.has(c));
    if (stillMissing.length) {
      this.logger.warn(
        `[getItemNames] STILL missing ${stillMissing.length} codes. sample=${stillMissing.slice(0, 10).join(',')}`,
      );
    }

    return map;
  }
}
