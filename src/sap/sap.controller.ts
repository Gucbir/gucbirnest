import { Controller, Get,UseGuards  } from '@nestjs/common';
import { SapService, SapUser } from './sap.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';


@Controller('sap')
export class SapController {
  constructor(private readonly sapService: SapService) {}
  // @UseGuards(JwtAuthGuard)
 @Get('users')
  async getSapUsers() {
    const users = await this.sapService.getUsers();

    // Frontend’e daha temiz bir shape döndürelim:
    return users.map((u: SapUser) => ({
      internalKey: u.InternalKey,
      userCode: u.UserCode,
      userName: u.UserName,
      email: u.E_Mail,
      mobile: u.MobilePhoneNumber,
      department: u.Department,
      branch: u.Branch,
      active: u.Locked === 'tNO',
    }));
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
