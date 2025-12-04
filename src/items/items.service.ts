import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
// Prisma tipini sadece where/orderBy için kullanıyoruz, istersen kaldırıp hepsini any yaparız.
import { Prisma } from '@prisma/client';
import { ItemsQueryDto } from './dto/items-query.dto';
import { SapService } from 'src/sap/sap.service';
@Injectable()
export class ItemsService {
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
}
