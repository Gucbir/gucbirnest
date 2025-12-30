import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SapService, SapUser } from './sap.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sap')
export class SapController {
  constructor(
    private readonly sapService: SapService,
    private readonly prisma: PrismaService,
  ) {}
  // @UseGuards(JwtAuthGuard)
  // @Get('users')
  // async getSapUsers() {
  //   const users = await this.sapService.getSapUsers(); // Zaten SapUser[] döndürüyor
  //   console.log(users);
  //   return users.map((u) => ({
  //     internalKey: u.InternalKey,
  //     userCode: u.UserCode,
  //     userName: u.UserName,
  //     email: u.E_Mail ?? null,
  //     mobile: u.MobilePhoneNumber ?? null,
  //     department: u.Department ?? null,
  //     branch: u.Branch ?? null,
  //     active: u.Locked === 'tNO', // tNO → aktif, tYES → kilitli
  //   }));
  // }
  @UseGuards(JwtAuthGuard)
  @Get('users')
  async getSapUsersWithDepartment(): Promise<any[]> {
    const [users, departments] = await Promise.all([
      this.sapService.getSapUsers(),
      this.sapService.getDepartments(),
    ]);

    return users.map((u) => {
      const dep = departments.find((d) => d.Code === u.Department);

      return {
        internalKey: u.InternalKey,
        userCode: u.UserCode,
        userName: u.UserName,
        departmentId: u.Department,
        departmentName: dep?.Name ?? null,
        branch: u.Branch,
        active: u.Locked === 'tNO',
        email: null,
        mobile: null,
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('departments')
  async getDepartments() {
    const depts = await this.sapService.getDepartments(); // Zaten SapUser[] döndürüyor
    console.log(depts);
    return depts;
  }

  @UseGuards(JwtAuthGuard)
  @Get('warehouses')
  async getWarehouses() {
    const warehouses = await this.sapService.getWarehouses(); // Zaten SapUser[] döndürüyor
    console.log(warehouses);
    return warehouses;
  }

  @Get('warehouses/:code/stocks')
  async listWarehouseStocks(
    @Param('code') code: string,
    @Query('onlyPositive') onlyPositive?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const onlyPos = onlyPositive !== 'false'; // default true
    const take = Math.min(Number(limit ?? 500), 5000);

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { WhsCode: code },
      select: { id: true, WhsCode: true, WhsName: true },
    });

    if (!warehouse) {
      return {
        warehouse: { WhsCode: code, WhsName: null },
        count: 0,
        items: [],
        message: 'Warehouse not found in PostgreSQL (run warehouse sync).',
      };
    }

    const where: any = { warehouseId: warehouse.id };
    if (onlyPos) where.InStock = { gt: 0 };

    if (q && q.trim()) {
      where.OR = [
        { ItemCode: { contains: q.trim(), mode: 'insensitive' } },
        { item: { ItemName: { contains: q.trim(), mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.itemWarehouseStock.findMany({
      where,
      take,
      orderBy: [{ InStock: 'desc' }, { ItemCode: 'asc' }],
      select: {
        itemId: true,
        warehouseId: true,
        ItemCode: true,
        InStock: true,
        IsCommited: true,
        OnOrder: true,
        updatedAt: true,
        item: { select: { ItemName: true, ForeignName: true } },
        warehouse: { select: { WhsCode: true, WhsName: true } },
      },
    });

    return {
      warehouse: { WhsCode: warehouse.WhsCode, WhsName: warehouse.WhsName },
      count: rows.length,
      items: rows.map((r) => ({
        itemId: r.itemId,
        warehouseId: r.warehouseId,
        ItemCode: r.ItemCode,
        ItemName: r.item?.ItemName ?? null,
        ForeignName: r.item?.ForeignName ?? null,
        InStock: r.InStock,
        IsCommited: r.IsCommited,
        OnOrder: r.OnOrder,
        updatedAt: r.updatedAt,
        WhsCode: r.warehouse?.WhsCode ?? warehouse.WhsCode,
        WhsName: r.warehouse?.WhsName ?? warehouse.WhsName,
      })),
    };
  }

  // 1) Login testi – sadece Login çalışıyor mu görelim
  @Get('login-test')
  async loginTest() {
    // Login'i tetiklemek için küçük bir GET atalım
    const bp = await this.sapService.get('/BusinessPartners?$top=1');
    return {
      message: 'Service Layer bağlantısı OK',
      sample: bp,
    };
  }

  // 2) Örnek: İlk 5 Business Partner
  @Get('business-partners')
  async getBusinessPartners() {
    const data = await this.sapService.get(
      '/BusinessPartners?$top=5&$select=CardCode,CardName,CardType',
    );
    return data;
  }
}
