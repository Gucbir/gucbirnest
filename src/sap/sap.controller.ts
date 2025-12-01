import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SapService, SapUser } from './sap.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sap')
export class SapController {
  constructor(private readonly sapService: SapService) {}
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

  @Get('warehouses')
  async getWarehouses() {
    const warehouses = await this.sapService.getWarehouses(); // Zaten SapUser[] döndürüyor
    console.log(warehouses);
    return warehouses;
  }

  @Get('warehouses/:code/stocks')
  async listWarehouseStocks(
    @Param('code') code: string,
    @Query('limit') limit?: string,
  ) {
    const top = limit ? parseInt(limit, 10) : 1000;
    return this.sapService.getWarehouseStocks(code, top);
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
