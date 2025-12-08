// src/purchase-requests/purchase-requests.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

export interface PurchaseRequest {
  docEntry: number;
  docNum: number;
  docDate: string;
  requiredDate?: string;
  requester?: string;
  requesterName?: string;
  documentStatus: string;
  lineCount: number;
}

interface FindAllOptions {
  from?: string; // 'YYYY-MM-DD'
  to?: string; // 'YYYY-MM-DD'
  includeClosed?: boolean;
  requester?: string;
  docNum?: string;
}

interface CreatePurchaseRequestLineDto {
  itemCode: string;
  quantity: number;
  warehouseCode: string;
  requiredDate?: string; // 'YYYY-MM-DD'
  remarks?: string;
}

interface CreatePurchaseRequestDto {
  requester: string;
  requesterName?: string;
  requiredDate?: string; // header level required date
  remarks?: string;
  lines: CreatePurchaseRequestLineDto[];
}

@Injectable()
export class PurchaseRequestsService {
  private readonly logger = new Logger(PurchaseRequestsService.name);

  constructor(private readonly sap: SapService) {}

  /**
   * Satın alma taleplerini filtrelerle birlikte SAP’ten çeker.
   * Service Layer’de sayfa sayfa dolaşarak hepsini birleştirir.
   */
  async findAll(options: FindAllOptions = {}): Promise<PurchaseRequest[]> {
    const { from, to, includeClosed = false, requester, docNum } = options;

    const baseParams: any = {
      $select:
        'DocEntry,DocNum,DocDate,RequriedDate,Requester,RequesterName,DocumentStatus',
      $orderby: 'DocDate desc',
    };

    // 🔍 OData filter
    const filters: string[] = [];

    if (from) filters.push(`DocDate ge '${from}'`);
    if (to) filters.push(`DocDate le '${to}'`);

    if (!includeClosed) {
      filters.push(`DocumentStatus eq 'bost_Open'`);
    }

    if (docNum) {
      const n = Number(docNum);
      if (!Number.isNaN(n)) filters.push(`DocNum eq ${n}`);
    }

    if (requester) {
      const safe = requester.replace(/'/g, "''");
      filters.push(`Requester eq '${safe}'`);
    }

    if (filters.length > 0) {
      baseParams.$filter = filters.join(' and ');
    }

    const allRows: any[] = [];

    // ⬇️ İlk isteği normal paramlarla atıyoruz
    let resource: string | null = 'PurchaseRequests';
    let params: any | undefined = baseParams;

    while (resource) {
      const slResponse = await this.sap.get(
        resource,
        params ? { params } : undefined,
      );

      const rows = Array.isArray(slResponse?.value)
        ? slResponse.value
        : Array.isArray(slResponse)
          ? slResponse
          : [];

      this.logger.log(`Fetched ${rows.length} rows from ${resource}`);

      allRows.push(...rows);

      // Sonraki sayfa var mı?
      const nextLink: string | undefined = slResponse['odata.nextLink'];

      if (nextLink) {
        // Örn: "PurchaseRequests?$select=...&$orderby=...&$skip=20"
        this.logger.log(`Next link: ${nextLink}`);

        resource = nextLink; // SapService.get full path'i kabul ediyorsa direkt böyle
        params = undefined; // çünkü nextLink zaten query paramları içeriyor
      } else {
        resource = null;
      }
    }

    this.logger.log(`TOTAL PURCHASE REQUESTS: ${allRows.length}`);

    return allRows.map((pr: any) => ({
      docEntry: pr.DocEntry,
      docNum: pr.DocNum,
      docDate: pr.DocDate,
      requiredDate: pr.RequriedDate,
      requester: pr.Requester,
      requesterName: pr.RequesterName,
      documentStatus: pr.DocumentStatus,
      lineCount: Array.isArray(pr.DocumentLines) ? pr.DocumentLines.length : 0,
    }));
  }

  async create(dto: CreatePurchaseRequestDto) {
    if (!dto.requester || !dto.requester.trim()) {
      throw new BadRequestException('Requester zorunludur');
    }

    if (!dto.lines || !dto.lines.length) {
      throw new BadRequestException('En az bir satır eklemelisiniz');
    }

    const invalidLine = dto.lines.find(
      (l) =>
        !l.itemCode?.trim() ||
        !l.warehouseCode?.trim() ||
        !l.quantity ||
        Number(l.quantity) <= 0,
    );

    if (invalidLine) {
      throw new BadRequestException(
        'Her satır için ItemCode, WarehouseCode ve Quantity (>0) zorunludur',
      );
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const headerRequiredDate = dto.requiredDate || today;

    const body: any = {
      // DocDate göndermezsen de SAP bugün yapar ama biz yine de yollayalım
      DocDate: today,
      RequriedDate: headerRequiredDate,
      Requester: dto.requester,
      RequesterName: dto.requesterName,
      Remarks: dto.remarks,
      DocumentLines: dto.lines.map((l) => ({
        ItemCode: l.itemCode,
        Quantity: Number(l.quantity),
        WarehouseCode: l.warehouseCode,
        RequiredDate: l.requiredDate || headerRequiredDate,
        FreeText: l.remarks,
      })),
    };

    this.logger.log(
      `Creating PurchaseRequest for requester=${dto.requester}, lineCount=${dto.lines.length}`,
    );

    const result = await this.sap.post('PurchaseRequests', body);

    return result; // SAP'in döndürdüğü DocEntry vs. zaten burada
  }
}
