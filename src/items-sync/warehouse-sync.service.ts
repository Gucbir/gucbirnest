import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Injectable()
export class WarehouseSyncService {
  private readonly logger = new Logger(WarehouseSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  async syncWarehouses() {
    this.logger.log('SAP → PostgreSQL Warehouse senkronu başlıyor...');

    const pageSize = 100;
    let skip = 0;
    const all: any[] = [];

    while (true) {
      const res: any = await this.sap.get('Warehouses', {
        params: {
          $select: 'WarehouseCode,WarehouseName,Inactive',
          $top: pageSize,
          $skip: skip,
        },
      });

      const page: any[] = res?.value || [];
      this.logger.log(
        `SAP Warehouses page skip=${skip}, çekilen=${page.length}`,
      );

      if (page.length === 0) break;

      all.push(...page);
      skip += page.length;
    }

    let updated = 0;

    for (const w of all) {
      await this.prisma.warehouse.upsert({
        where: { WhsCode: w.WarehouseCode },
        update: {
          WhsName: w.WarehouseName,
          isActive: w.Inactive !== 'tYES', // SAP Inactive = tYES ise bizde false
        },
        create: {
          WhsCode: w.WarehouseCode,
          WhsName: w.WarehouseName,
          isActive: w.Inactive !== 'tYES',
        },
      });

      updated++;
    }

    this.logger.log(
      `Warehouse senkron tamamlandı ✅ ${updated} kayıt eklendi/güncellendi.`,
    );

    return { updated };
  }
}
