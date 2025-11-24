import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SapService } from '../sap/sap.service';
import { OrderUpdateDto } from './dto/order-update.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';
import {
  ProductionOrderIdCardInfoRequestDto,
  ProductionOrderIdCardInfoDto,
} from './dto/production-order-id-card.dto';
import { LocalOrderReportDto } from './dto/local-order-report.dto';
import { FirstRouteIssueRequestDto, GoodsIssueResultDto } from './dto/first-route-issue.dto';
import { FirstRouteGiLine } from './dto/first-route-gi-line.dto';


@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly sap: SapService) {}

  /**
   * C# OrderController.Update (OWOR UPDATE) -> Service Layer versiyonu
   * POST api/SAP/Order/update
   */
  async updateOrderBySerial(dto: OrderUpdateDto) {
    if (!dto.U_U_DURUM && !dto.U_U_ROTA) {
      throw new BadRequestException('No fields to update.');
    }

    // 1) ProductionOrders içinde U_U_SRN ile order bul
    const srn = dto.U_U_SRN.replace(/'/g, "''");
    const filter = encodeURIComponent(`U_U_SRN eq '${srn}'`);

    const data = await this.sap.get<{ value: any[] }>(
      `/ProductionOrders?$select=DocEntry,U_U_DURUM,U_U_ROTA&$filter=${filter}`,
    );

    if (!data.value || data.value.length === 0) {
      throw new NotFoundException(`Order not found for U_U_SRN=${dto.U_U_SRN}`);
    }

    const order = data.value[0];
    const docEntry = order.DocEntry;

    const patchBody: any = {};
    if (dto.U_U_DURUM !== undefined) patchBody.U_U_DURUM = dto.U_U_DURUM;
    if (dto.U_U_ROTA !== undefined) patchBody.U_U_ROTA = dto.U_U_ROTA;

    // 2) PATCH /ProductionOrders(DocEntry)
    await this.sap.patch(`/ProductionOrders(${docEntry})`, patchBody);

    return { message: 'Order updated.', DocEntry: docEntry };
  }

  /**
   * C# UpdateProductionLine endpoint'i
   * POST api/SAP/Order/update-production-line
   */
  async updateProductionLine(dto: UpdateProductionLineDto) {
    if (!dto.DocEntry || !dto.ProductionLine?.trim()) {
      throw new BadRequestException(
        'Both DocEntry and ProductionLine are required.',
      );
    }

    const docEntry = dto.DocEntry;
    this.logger.log(
      `[updateProductionLine] User=${dto.UserName ?? ''}, DocEntry=${docEntry}, ProductionLine=${
        dto.ProductionLine
      }`,
    );

    const patchBody = {
      U_U_BANT: dto.ProductionLine,
    };

    await this.sap.patch(`/ProductionOrders(${docEntry})`, patchBody);

    return {
      DocEntry: docEntry,
      ProductionLine: dto.ProductionLine,
    };
  }

  /**
   * C# GetProductionOrderIdCardInfo endpoint'i
   * POST api/SAP/Order/id-card-info
   *
   * Not: Bu örnekte SAP tarafında IDCARD_INFO isimli bir SQL Query tanımladığını varsayıyoruz.
   * Eğer henüz tanımlamadıysan, SQL kısmını SAP'de query olarak açmamız gerekecek.
   */
  async getProductionOrderIdCardInfo(
    dto: ProductionOrderIdCardInfoRequestDto,
  ): Promise<ProductionOrderIdCardInfoDto> {
    if (!dto.DocEntry) {
      throw new BadRequestException('DocEntry is required');
    }

    // Burada Service Layer SQLQueries kullanıyoruz.
    // Gerçek endpoint yapın senin ortamına göre: /SQLQueries('IDCARD_INFO')/List benzeri.
    const body = {
      Parameters: [
        {
          Name: 'ProdDocEntry',
          Value: dto.DocEntry.toString(),
        },
      ],
    };

    const result = await this.sap.post<{ value: any[] }>(
      `/SQLQueries('IDCARD_INFO')/List`,
      body,
    );

    if (!result.value || result.value.length === 0) {
      throw new NotFoundException(
        `OWOR not found for DocEntry ${dto.DocEntry}`,
      );
    }

    const row = result.value[0];

    const mapString = (field: string) =>
      row[field] === null || row[field] === undefined
        ? undefined
        : String(row[field]);

    const response: ProductionOrderIdCardInfoDto = {
      ProdOrderDocEntry: Number(row.ProdOrderDocEntry ?? 0),
      SalesOrderDocEntry: Number(row.SalesOrderDocEntry ?? 0),

      U_U_SRN: mapString('U_U_SRN'),
      U_U_MM: mapString('U_U_MM'),
      U_U_MSR: mapString('U_U_MSR'),
      U_U_ALM: mapString('U_U_ALM'),
      U_U_ALTSR: mapString('U_U_ALTSR'),
      U_U_SPN: mapString('U_U_SPN'),

      U_KABIN: mapString('U_KABIN'),
      U_ATS: mapString('U_ATS'),
      U_TMS: mapString('U_TMS'),
      U_ACIKLAMA: mapString('U_ACIKLAMA'),
      U_FB_A: mapString('U_FB_A'),
      U_UPEX_Items_Text: mapString('U_UPEX_Items_Text'),
      Text: mapString('Text'),

      Description: mapString('Description'),
    };

    return response;
  }

  // -------------------------------
  // Aşağıdakiler şimdilik sadece stub, TS hatası vermesin diye.
  // Sonra teker teker C# koduna göre doldururuz.
  // -------------------------------

  async getStageStatusReport(): Promise<any> {
    // TODO: C# GetStageStatusReport SQL -> SAP SQLQueries ile buraya taşınacak
    return [];
  }

  async getWithElapsedReport(): Promise<LocalOrderReportDto[]> {
    // 1) SAP SQL Query çağrısı
    // Parametre olmadığı için body boş ya da { Parameters: [] } olabilir.
    const body = { Parameters: [] as any[] };

    const result = await this.sap.post<{ value: any[] }>(
      `/SQLQueries('WITH_ELAPSED_REPORT')/List`,
      body,
    );

    const rows = result.value ?? [];

    const now = new Date();

    const mapRow = (row: any): LocalOrderReportDto => {
      // ham alanları al
      const docEntry = row.DocEntry != null ? Number(row.DocEntry) : null;
      const itemCode = row.ItemCode ?? null;
      const prodName = row.ProdName ?? null;
      const u_u_spn = row.U_U_SPN ?? null;
      const u_u_srn = row.U_U_SRN ?? null;
      const u_u_durum = row.U_U_DURUM ?? null;
      const u_u_rota = row.U_U_ROTA ?? null;
      const u_u_bant = row.U_U_BANT ?? null;
      const createDate = row.CreateDate ?? null;
      const rotaName = row.RotaName ?? null;
      const lastStatusTimeRaw = row.LastStatusTime;
      const lastStatusDateRaw = row.LastStatusDate;
      const lastStatusSecondRaw = row.LastStatusSecond;
      const lastUser = row.LastUser ?? null;
      const startProcessTimeRaw = row.StartProcessTime;
      const startProcessDateRaw = row.StartProcessDate;
      const startProcessSecondRaw = row.StartProcessSecond;
      const lastDurdurmaNedeni = row.LastDurdurmaNedeni ?? null;

      // 2) elapsedSeconds hesabı (C# ile bire bir aynı mantık)
      let elapsedSeconds: number | null = null;

      if (lastStatusTimeRaw != null && lastStatusDateRaw != null) {
        const hhmm = parseInt(String(lastStatusTimeRaw), 10);
        if (!isNaN(hhmm)) {
          const datePart = new Date(lastStatusDateRaw);
          if (!isNaN(datePart.getTime())) {
            const hour = Math.floor(hhmm / 100);
            const minute = hhmm % 100;
            let second = 0;
            if (lastStatusSecondRaw != null) {
              const secParsed = parseInt(String(lastStatusSecondRaw), 10);
              if (!isNaN(secParsed)) second = secParsed;
            }

            const combined = new Date(
              datePart.getFullYear(),
              datePart.getMonth(),
              datePart.getDate(),
              hour,
              minute,
              second,
            );

            elapsedSeconds = Math.floor(
              (now.getTime() - combined.getTime()) / 1000,
            );
          }
        }
      }

      // 3) elapsedSinceStart hesabı
      let elapsedSinceStart: number | null = null;

      if (startProcessTimeRaw != null && startProcessDateRaw != null) {
        const startHhmm = parseInt(String(startProcessTimeRaw), 10);
        if (!isNaN(startHhmm)) {
          const startDatePart = new Date(startProcessDateRaw);
          if (!isNaN(startDatePart.getTime())) {
            const startHour = Math.floor(startHhmm / 100);
            const startMinute = startHhmm % 100;
            let startSecond = 0;
            if (startProcessSecondRaw != null) {
              const secParsed = parseInt(String(startProcessSecondRaw), 10);
              if (!isNaN(secParsed)) startSecond = secParsed;
            }

            const startCombined = new Date(
              startDatePart.getFullYear(),
              startDatePart.getMonth(),
              startDatePart.getDate(),
              startHour,
              startMinute,
              startSecond,
            );

            elapsedSinceStart = Math.floor(
              (now.getTime() - startCombined.getTime()) / 1000,
            );
          }
        }
      }

      const dto: LocalOrderReportDto = {
        docEntry,
        itemCode,
        prodName,
        u_u_spn,
        u_u_srn,
        u_u_durum,
        u_u_rota,
        u_u_bant,
        createDate: createDate ? String(createDate) : null,
        rotaName,
        lastStatusTime:
          lastStatusTimeRaw != null
            ? parseInt(String(lastStatusTimeRaw), 10)
            : null,
        lastStatusDate: lastStatusDateRaw ? String(lastStatusDateRaw) : null,
        elapsedSeconds,
        lastUser,
        startProcessTime:
          startProcessTimeRaw != null
            ? parseInt(String(startProcessTimeRaw), 10)
            : null,
        startProcessDate: startProcessDateRaw
          ? String(startProcessDateRaw)
          : null,
        elapsedSinceStart,
        lastDurdurmaNedeni,
      };

      return dto;
    };

    return rows.map(mapRow);
  }

  async getWithElapsed(): Promise<any> {
    // TODO: C# GetWithElapsed SQL -> SAP SQLQueries
    return [];
  }

  async getMaterialsListOrderWithStock(body: any): Promise<any> {
    // TODO: MaterialsListOrderWithStock SQL + Serial logic -> Service Layer / SQLQueries
    return [];
  }

  async sendMaterialChangeRequestMail(body: any): Promise<any> {
    // TODO: Scriban + SmtpClient yerine Nodemailer + template engine
    return { message: 'Not implemented yet in NestJS.' };
  }

  async getOrdersWithFirstStage(): Promise<any> {
    // TODO: C# GetOrdersWithFirstStage SQL -> SQLQueries
    return [];
  }

   /**
   * C# PostFirstRouteIssue (first-route-issue) endpoint'inin
   * NestJS + Service Layer karşılığı.
   *
   * Varsayım: SAP tarafında FIRST_ROUTE_GI_LINES isimli bir SQL Query var ve
   * FirstRouteGiLine DTO'sundaki kolonları döndürüyor.
   */
  async postFirstRouteIssue(
    dto: FirstRouteIssueRequestDto,
  ): Promise<GoodsIssueResultDto> {
    this.logger.log(
      `🚀 [FirstRouteIssue] START - DocEntry=${dto.DocEntry}, User=${dto.UserName ?? 'Unknown'}`,
    );

    if (!dto.DocEntry || dto.DocEntry <= 0) {
      throw new BadRequestException('DocEntry is required and must be > 0');
    }

    // 1) Önce üretim siparişini çekelim, gerekirse status = Released yapalım
    const po = await this.sap.get<any>(
      `/ProductionOrders(${dto.DocEntry})?$select=DocEntry,DocumentStatus,ProductionOrderStatus`,
    );

    // Service Layer'de: ProductionOrderStatus = 'boposPlanned' | 'boposReleased' | ...
    if (po && po.ProductionOrderStatus !== 'boposReleased') {
      this.logger.log(
        `[FirstRouteIssue] Releasing production order DocEntry=${dto.DocEntry}`,
      );
      await this.sap.patch(`/ProductionOrders(${dto.DocEntry})`, {
        ProductionOrderStatus: 'boposReleased',
      });
    }

    // 2) SQL Query'den GI satırlarını alalım
    const sqlBody = {
      Parameters: [
        {
          Name: 'ProdDocEntry',
          Value: dto.DocEntry.toString(),
        },
      ],
    };

    const sqlResult = await this.sap.post<{ value: FirstRouteGiLine[] }>(
      `/SQLQueries('FIRST_ROUTE_GI_LINES')/List`,
      sqlBody,
    );

    const lines = sqlResult.value ?? [];
    if (!lines.length) {
      throw new BadRequestException(
        `No first-route materials found for DocEntry=${dto.DocEntry}`,
      );
    }

    this.logger.log(
      `[FirstRouteIssue] SQL returned ${lines.length} GI lines for DocEntry=${dto.DocEntry}`,
    );

    // 3) InventoryGenExit dokümanını hazırlayalım
    const today = new Date();
    const docDate = today.toISOString().substring(0, 10); // yyyy-MM-dd

    const giBody: any = {
      DocDate: docDate,
      Comments: `İlk Rota Çık - Üretim Siparişi No: ${dto.DocEntry}`,
      DocumentLines: [] as any[],
    };

    for (const row of lines) {
      const isSerialManaged =
        row.IsSerialManaged === true ||
        row.IsSerialManaged === 'Y' ||
        row.IsSerialManaged === 'y';

      const docLine: any = {
        BaseType: 202, // oProductionOrders
        BaseEntry: row.DocEntry,
        BaseLine: row.LineNum,
        Quantity: row.Quantity,
        WarehouseCode: row.WarehouseCode,
      };

      if (isSerialManaged) {
        // Seri ürünler için SQL tarafı SerialNumber + SysSerialNumber üretmiş olmalı
        if (!row.SerialNumber || !row.SysSerialNumber) {
          // Burada C#'taki TrySendErrorEmailSafe + BadRequest pattern'inin
          // basit versiyonunu kullanıyoruz.
          const msg = `Serial managed item but no serial info in query result. DocEntry=${row.DocEntry}, Line=${row.LineNum}, Item=${row.ItemCode}`;
          this.logger.error(`[FirstRouteIssue] ${msg}`);
          throw new BadRequestException(msg);
        }

        docLine.SerialNumbers = [
          {
            InternalSerialNumber: row.SerialNumber,
            SystemSerialNumber: row.SysSerialNumber,
            Quantity: 1,
          },
        ];

        // Motor / Altern özel mesaj/log istersen buraya ekleyebilirsin:
        if (row.MotorOrAlternType === 'MOTOR') {
          this.logger.log(
            `[FirstRouteIssue] MOTOR serial pick: ${row.SerialNumber} for item ${row.ItemCode}`,
          );
        } else if (row.MotorOrAlternType === 'ALTERN') {
          this.logger.log(
            `[FirstRouteIssue] ALTERN serial pick: ${row.SerialNumber} for item ${row.ItemCode}`,
          );
        }
      }

      giBody.DocumentLines.push(docLine);
    }

    this.logger.log(
      `[FirstRouteIssue] About to POST InventoryGenExit with ${giBody.DocumentLines.length} lines`,
    );

    try {
      // 4) InventoryGenExit'ı oluştur
      const created = await this.sap.post<any>(
        `/InventoryGenExits`,
        giBody,
      );

      // Service Layer başarılı olursa genelde dokümanı geri döner (DocEntry ile birlikte)
      const newDocEntry = created?.DocEntry;

      this.logger.log(
        `✅ [FirstRouteIssue] InventoryGenExit created. DocEntry=${newDocEntry}`,
      );

      const result: GoodsIssueResultDto = {
        message: 'First route goods issue created',
        docEntry: newDocEntry,
      };
      return result;
    } catch (err: any) {
      // Service Layer hata formatı:
      // err.response.data = { error: { code: ..., message: { value: '...' } } }
      const code = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message?.value ?? err.message;

      this.logger.error(
        `💥 [FirstRouteIssue] InventoryGenExit failed. Code=${code}, Message=${msg}`,
      );

      // Negatif stok hata kodunu yakalayıp BadRequest'e çevirebilirsin
      if (code === -10 || code === '-10') {
        throw new BadRequestException(
          `Warning: negative inventory prevented issuing first route: ${msg}`,
        );
      }

      throw new BadRequestException(`Goods issue failed: ${msg}`);
    }
  }


  async postFirstStageAvailability(body: any): Promise<any> {
    // TODO: C# PostFirstStageAvailability -> SQLQueries + logic
    return [];
  }
}
