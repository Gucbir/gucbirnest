import { Injectable, Logger } from '@nestjs/common';
import { SapUsersService } from './sap-users.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SapUsersSyncService {
  private readonly logger = new Logger(SapUsersSyncService.name);

  constructor(
    private readonly sapUsersService: SapUsersService,
    private readonly prisma: PrismaService,
  ) {}

  async syncSapUsers() {
    this.logger.log(
      '🚀 [sapusers:sync] SAP → PostgreSQL kullanıcı senkronu başlıyor...',
    );

    const users = await this.sapUsersService.findAll({ onlyActive: true });

    const payload = users.map((u: any) => ({
      internalKey: u.internalKey,
      userCode: u.userCode,
      userName: u.userName,
      email: u.email,
      active: u.active,
    }));

    const settingName = 'sapusers';

    const setting = await this.prisma.setting.upsert({
      where: { name: settingName },
      update: { settings: payload },
      create: { name: settingName, settings: payload },
    });

    this.logger.log(
      `✔️ [sapusers:sync] ${payload.length} aktif kullanıcı Setting.name='${settingName}' (id=${setting.id}) kaydına yazıldı.`,
    );

    return {
      count: payload.length,
      settingId: setting.id,
    };
  }
}
