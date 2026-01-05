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
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    const where: Prisma.ItemWhereInput = {};

    // --- Temel filtreler ---
    if (query.itemType) where.ItemType = query.itemType;

    if (query.inventoryItem !== undefined)
      where.InventoryItem = query.inventoryItem === 'true';

    if (query.salesItem !== undefined)
      where.SalesItem = query.salesItem === 'true';

    if (query.purchaseItem !== undefined)
      where.PurchaseItem = query.purchaseItem === 'true';

    if (query.valid !== undefined) where.Valid = query.valid === 'true';
    if (query.frozen !== undefined) where.Frozen = query.frozen === 'true';
    if (query.assetItem !== undefined)
      where.AssetItem = query.assetItem === 'true';

    // ✅ groupCode artık ItemGroup.code
    if (query.groupCode !== undefined && query.groupCode !== null) {
      where.itemGroup = { code: Number(query.groupCode) };
    }

    // ✅ Sadece stoklu
    if (query.hasStock === 'true') {
      where.QuantityOnStock = { gt: 0 };
    }

    // --- Arama OR'ları (tek seferde) ---
    const ors: Prisma.ItemWhereInput[] = [];

    const s = query.search?.trim();
    if (s) {
      ors.push(
        { ItemCode: { contains: s, mode: 'insensitive' } },
        { ItemName: { contains: s, mode: 'insensitive' } },
        { ForeignName: { contains: s, mode: 'insensitive' } },
        { Marka: { contains: s, mode: 'insensitive' } },
        { AlternatorModel: { contains: s, mode: 'insensitive' } },
      );
    }

    const e = (query as any).engine?.trim(); // DTO'ya engine eklediysen (query.engine) kullan
    if (e) {
      ors.push(
        { ItemName: { contains: e, mode: 'insensitive' } },
        { Marka: { contains: e, mode: 'insensitive' } },
      );
    }

    if (ors.length) where.OR = ors;

    // --- Sorting (güvenli) ---
    const allowedOrderBy = new Set([
      'ItemCode',
      'ItemName',
      'QuantityOnStock',
      'AvgPrice',
    ]);
    const orderByField = allowedOrderBy.has(String(query.orderBy))
      ? String(query.orderBy)
      : 'ItemCode';
    const orderDir =
      String(query.orderDir).toLowerCase() === 'desc' ? 'desc' : 'asc';

    const orderByClause: Prisma.ItemOrderByWithRelationInput = {
      [orderByField]: orderDir,
    } as any;

    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        orderBy: orderByClause,
        skip,
        take,
        include: { itemGroup: true }, // istersen
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        pageCount: Math.max(1, Math.ceil(total / limit)),
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

  // src/items/items.service.ts
  async getFilterOptions() {
    const MOTOR_GROUP = 113;
    const ALT_GROUP = 114;

    const [motorBrands, alternatorModels] = await this.prisma.$transaction([
      // Motor markaları (Marka alanı)
      this.prisma.item.findMany({
        where: {
          itemGroup: { code: MOTOR_GROUP },
          Marka: { not: null },
        },
        distinct: ['Marka'],
        select: { Marka: true },
        orderBy: { Marka: 'asc' },
      }),

      // Alternatör modelleri (AlternatorModel alanı)
      this.prisma.item.findMany({
        where: {
          itemGroup: { code: ALT_GROUP },
          AlternatorModel: { not: null },
        },
        distinct: ['AlternatorModel'],
        select: { AlternatorModel: true },
        orderBy: { AlternatorModel: 'asc' },
      }),
    ]);

    return {
      engineOptions: motorBrands
        .map((x) => (x.Marka || '').trim())
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),

      alternatorModelOptions: alternatorModels
        .map((x) => (x.AlternatorModel || '').trim())
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),

      // şimdilik statik bırak (DB’de alan yok)
      hzOptions: [
        { value: '50', label: '50 Hz' },
        { value: '60', label: '60 Hz' },
      ],
      kvaStandbyOptions: [{ value: 'ALL', label: 'Tümü' }],
      kvaPrimeOptions: [{ value: 'ALL', label: 'Tümü' }],
      emissionOptions: [{ value: 'ALL', label: 'Tümü' }],
    };
  }
}
