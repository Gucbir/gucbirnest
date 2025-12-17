import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Setting } from '@prisma/client';

function parseSerial(input: string) {
  const s = String(input || '').trim();
  if (!s) throw new Error('Seri no boş olamaz');

  const m = s.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) throw new Error('Seri no formatı geçersiz. Örn: GJ10050049');

  return {
    prefix: m[1].toUpperCase(),
    next: Number(m[2]),
    pad: m[2].length,
  };
}
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

  async getProductionSerial() {
    const row = await this.prisma.setting.findUnique({
      where: { name: 'productionSerial' },
    });

    return row?.settings || null;
  }

  /**
   * Başlangıç seri no ayarını kaydeder
   * Örn: "GJ10050049"
   */
  async updateProductionSerial(startSerial: string) {
    try {
      const parsed = parseSerial(startSerial);

      const data = {
        prefix: parsed.prefix,
        next: parsed.next, // bir sonraki verilecek seri
        pad: parsed.pad,
      };

      const saved = await this.prisma.setting.upsert({
        where: { name: 'productionSerial' },
        create: { name: 'productionSerial', settings: data },
        update: { settings: data },
      });

      return saved.settings;
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  async upsertSetting(name: string, settings: any) {
    if (!name) throw new BadRequestException('name zorunlu');

    const row = await this.prisma.setting.upsert({
      where: { name },
      create: { name, settings },
      update: { settings },
    });

    return row;
  }
}
