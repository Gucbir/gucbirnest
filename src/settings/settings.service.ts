import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Setting } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(name: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({
      where: { name },
    });
  }

  async updateSetting(name: string, settings: any) {
    return this.prisma.setting.upsert({
      where: { name },
      update: { settings: settings }, // array → JSON string
      create: { name, settings: settings },
    });
  }
}
