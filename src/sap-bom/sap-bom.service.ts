import { Injectable, Logger } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

@Injectable()
export class SapBomService {
  private readonly logger = new Logger(SapBomService.name);

  constructor(private readonly sap: SapService) {}

  // SQLQueries('BomByItemCode')/List kullanıyoruz (senin mevcut yaklaşım)
  async getBomByItemCode(itemCode: string) {
    const code = String(itemCode ?? '').trim();
    if (!code) return [];

    this.logger.log(`SAP → BOM çekiliyor: ${code}`);

    const res: any = await this.sap.post(`SQLQueries('BomByItemCode')/List`, {
      ParamList: `ItemCode='${code}'`,
    });

    return res?.value ?? [];
  }
}
