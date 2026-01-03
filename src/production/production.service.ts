import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Injectable,
  Req,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';
import crypto from 'crypto';
import { MaterialCheckService } from '../material-check/material-check.service';
import { ProcurementService } from '../procurement/procurement.service';
import { MaterialCheckModule } from '../material-check/material-check.module';
import { ImportFromOrderLineDto } from './dto/import-from-order-line.dto';
import { ItemsService } from '../items/items.service';
import { SapBomService } from '../sap-bom/sap-bom.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { ResumeOperationDto } from './dto/resume-operation.dto';
import { PauseOperationDto } from './dto/pause-operation.dto';
import { Prisma } from '@prisma/client';

const STAGE_MAP_BY_ID: Record<
  string,
  {
    stageCode: string;
    stageName: string;
    sequenceNo?: number;
    departmentCode?: string | null;
  }
> = {
  '1': {
    stageCode: 'AKUPLE',
    stageName: 'AKUPLE',
    sequenceNo: 10,
    departmentCode: 'AKUPLE',
  },
  '2': {
    stageCode: 'MOTOR_MONTAJ',
    stageName: 'MOTOR MONTAJ',
    sequenceNo: 20,
    departmentCode: 'MOTOR',
  },
  '3': {
    stageCode: 'PANO_TESISAT',
    stageName: 'PANO VE TESİSAT',
    sequenceNo: 30,
    departmentCode: 'TESISAT',
  },
  '4': {
    stageCode: 'TEST',
    stageName: 'JENERATÖR TEST',
    sequenceNo: 40,
    departmentCode: 'TEST',
  },
  '5': {
    stageCode: 'KABIN_GIYDIRME',
    stageName: 'KABİN GİYDİRME',
    sequenceNo: 50,
    departmentCode: 'KABIN',
  },
  '6': {
    stageCode: 'FONK_KALITE',
    stageName: 'FONKSİYONEL KALİTE KONTROL',
    sequenceNo: 60,
    departmentCode: 'KALITE',
  },
  '7': {
    stageCode: 'FINAL',
    stageName: 'FİNAL KONTROL',
    sequenceNo: 70,
    departmentCode: 'KALITE',
  },
};

const STAGE_MAP: Record<
  string,
  {
    stageCode: string;
    stageName: string;
    sequenceNo: number;
    departmentCode: string;
  }
> = {
  // örnek StageId değerlerini kendi SAP routing’inle eşle
  // StageId numeric geliyorsa key'i String(StageId) yapacağız
  '1': {
    stageCode: 'AKUPLE',
    stageName: 'AKUPLE MONTAJ',
    sequenceNo: 10,
    departmentCode: 'AKUPLE',
  },
  '2': {
    stageCode: 'MOTOR_MONTAJ',
    stageName: 'MOTOR MONTAJ',
    sequenceNo: 20,
    departmentCode: 'MOTOR',
  },
  '3': {
    stageCode: 'PANO_TESISAT',
    stageName: 'PANO TESİSAT',
    sequenceNo: 30,
    departmentCode: 'TESISAT',
  },
  '4': {
    stageCode: 'TEST',
    stageName: 'TEST',
    sequenceNo: 40,
    departmentCode: 'TEST',
  },
  '5': {
    stageCode: 'KABIN_GIYDIRME',
    stageName: 'KABİN GİYDİRME',
    sequenceNo: 50,
    departmentCode: 'KABIN',
  },
};

const DEFAULT_STAGE = {
  stageCode: 'GENEL',
  stageName: 'GENEL',
  sequenceNo: 999,
  departmentCode: 'GENEL',
};

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
    private readonly materialCheck: MaterialCheckService,
    private readonly procurement: ProcurementService,
    private readonly itemsService: ItemsService,
    private readonly sapBomService: SapBomService,
  ) {}

  private normalizeStageCode(code: string) {
    return String(code ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/[^\w]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async importFromOrderLine(dto: any) {
    const docEntry = Number(dto?.docEntry ?? dto?.orderId);
    const lineNum = Number(dto?.lineNum);
    const itemCode = String(dto?.itemCode ?? '').trim();
    const quantity = Number(dto?.quantity);
    const whsCode = String(dto?.whsCode ?? '01').trim();

    if (!docEntry || Number.isNaN(docEntry))
      throw new BadRequestException('docEntry zorunlu');
    if (Number.isNaN(lineNum)) throw new BadRequestException('lineNum zorunlu');
    if (!itemCode) throw new BadRequestException('itemCode zorunlu');
    if (!quantity || quantity <= 0)
      throw new BadRequestException('quantity 0 olamaz');

    this.logger.log(
      `[importFromOrderLine] docEntry=${docEntry} lineNum=${lineNum} itemCode=${itemCode} qty=${quantity} whs=${whsCode}`,
    );

    await this.materialCheck.checkOrderLineMaterial({
      parentItemCode: itemCode,
      requestedQty: quantity,
      fallbackWhsCode: whsCode,
    });

    const namesMap = await this.itemsService.getItemNames([itemCode]);
    const itemName = namesMap.get(itemCode);
    if (!itemName)
      throw new BadRequestException(`itemName bulunamadı: ${itemCode}`);

    const { items: bomItems, routeStages: bomRouteStages } =
      await this.sapBomService.getBomByItemCode(itemCode);

    // ✅ items payload (stageId: 1..7 olmalı)
    const items = (bomItems ?? [])
      .filter((x) => x.lineType === 4) // istersen kaldır
      .map((x) => ({
        itemCode: x.itemCode,
        itemName: x.itemName,
        quantity: x.quantity, // per-unit
        whsCode: x.whsCode,
        issueMethod: x.issueMethod,
        stageId: x.stageId ?? null, // ✅ 1..7 (ITT2 stageId)
        visOrder: x.visOrder ?? 0,
      }))
      .filter((x) => x.itemCode && x.quantity > 0);

    // ✅ routeStages payload (ITT2)
    const routeStages = (bomRouteStages ?? []).map((s) => ({
      stageId: s.stageId ?? null, // 1..7
      stageName: s.stageName ?? '', // "MOTOR MONTAJ"
      stageCodeRaw: s.stageCodeRaw ?? '', // "MOTOR MONTAJ" (raw)
      visOrder: s.seqNum ?? 0, // sıra
    }));

    this.logger.log(
      `[importFromOrderLine] routeStages=${routeStages.length} items=${items.length} stageIds=${JSON.stringify(
        routeStages.map((s) => s.stageId),
      )}`,
    );

    const createDto: CreateProductionOrderDto = {
      docEntry,
      itemCode,
      itemName,
      quantity,
    };

    const prod = await this.createProductionOrder(createDto, {
      routeStages,
      items,
      lineMeta: { lineNum, whsCode },
    });

    return { ok: true, productionOrderId: prod?.id, docEntry, lineNum };
  }

  async createProductionOrderAkupleOnly(
    dto: CreateProductionOrderDto,
    payload: {
      akupleItems: {
        itemCode: string;
        itemName: string | null;
        quantity: number;
        whsCode: string | null;
        issueMethod: string | null;
        visOrder: number;
      }[];
    },
  ) {
    const sapDocEntry = dto.docEntry != null ? Number(dto.docEntry) : null;
    const sapDocNum = dto.docNum != null ? Number(dto.docNum) : null;

    const itemCode = String(dto.itemCode ?? '').trim();
    const itemName = String(dto.itemName ?? '').trim();
    const quantity = Number(dto.quantity);

    if (!itemCode) throw new BadRequestException('itemCode zorunlu');
    if (!itemName) throw new BadRequestException('itemName zorunlu');
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new BadRequestException('quantity 0 olamaz');
    if (!Number.isInteger(quantity))
      throw new BadRequestException(`quantity integer olmalı. got=${quantity}`);

    const shouldHaveSerial = itemCode.startsWith('6.');

    return this.prisma.$transaction(async (tx) => {
      // 1) idempotent order
      const existing = await tx.productionOrder.findFirst({
        where: {
          ...(sapDocEntry ? { sapDocEntry } : {}),
          ...(sapDocNum && !sapDocEntry ? { sapDocNum } : {}),
          itemCode,
          status: { not: 'cancelled' },
        },
        select: { id: true },
      });

      const order = existing
        ? await tx.productionOrder.update({
            where: { id: existing.id },
            data: {
              sapDocEntry,
              sapDocNum,
              itemCode,
              itemName,
              quantity,
              status: 'planned',
            },
          })
        : await tx.productionOrder.create({
            data: {
              sapDocEntry,
              sapDocNum,
              itemCode,
              itemName,
              quantity,
              status: 'planned',
            },
          });

      // 2) units
      if (shouldHaveSerial) {
        const currentUnitCount = await tx.productionOrderUnit.count({
          where: { orderId: order.id },
        });

        const needToCreate = Math.max(0, quantity - currentUnitCount);

        for (let i = 0; i < needToCreate; i++) {
          const serialNo = await this.allocateNextProductionSerial(tx);
          await tx.productionOrderUnit.create({
            data: { orderId: order.id, serialNo, status: 'planned' },
          });
        }
      }

      const units = shouldHaveSerial
        ? await tx.productionOrderUnit.findMany({
            where: { orderId: order.id },
            select: { id: true, serialNo: true, status: true },
            orderBy: { id: 'asc' },
          })
        : [];

      // 3) ✅ AKUPLE operation upsert (öneri: schema’ya @@unique([orderId, stageCode]) ekli olsun)
      const opExisting = await tx.productionOperation.findFirst({
        where: { orderId: order.id, stageCode: 'AKUPLE' },
        select: { id: true },
      });

      const akupleOp = opExisting
        ? await tx.productionOperation.update({
            where: { id: opExisting.id },
            data: {
              stageCode: 'AKUPLE',
              stageName: 'AKUPLE',
              sequenceNo: 10,
              departmentCode: 'AKUPLE',
              status: 'waiting',
            },
          })
        : await tx.productionOperation.create({
            data: {
              orderId: order.id,
              stageCode: 'AKUPLE',
              stageName: 'AKUPLE',
              sequenceNo: 10,
              departmentCode: 'AKUPLE',
              status: 'waiting',
            },
          });

      // 4) ✅ Template varsa kullan, yoksa payload.akupleItems ile template yarat
      let template = await tx.akupleItemTemplate.findUnique({
        where: { parentItemCode: itemCode },
        include: { lines: true },
      });

      if (!template || !template.lines?.length) {
        const input = Array.isArray(payload?.akupleItems)
          ? payload.akupleItems
          : [];

        const linesData = input
          .sort((a, b) => Number(a.visOrder ?? 0) - Number(b.visOrder ?? 0))
          .map((l, idx) => ({
            itemCode: String(l.itemCode ?? '').trim(),
            itemName:
              String(l.itemName ?? '').trim() ||
              String(l.itemCode ?? '').trim(),
            quantity: Number(l.quantity ?? 0) || 0, // ✅ per-unit
            warehouseCode: l.whsCode ? String(l.whsCode) : null,
            issueMethod: l.issueMethod ? String(l.issueMethod) : null,
            lineNo: Number(l.visOrder ?? idx) || idx,
            uomName: null,
          }))
          .filter((x) => x.itemCode && x.quantity > 0);

        if (!linesData.length) {
          throw new BadRequestException(
            `[AKUPLE] template yok ve payload.akupleItems boş. itemCode=${itemCode}`,
          );
        }

        template = await tx.akupleItemTemplate.create({
          data: {
            parentItemCode: itemCode,
            parentItemName: itemName,
            lines: { create: linesData },
          },
          include: { lines: true },
        });
      }

      // 5) ✅ AKUPLE operation items reset + bas
      await tx.productionOperationItem.deleteMany({
        where: { operationId: akupleOp.id },
      });

      const opItemsData = template.lines
        .sort((a, b) => Number(a.lineNo ?? 0) - Number(b.lineNo ?? 0))
        .map((l, idx) => ({
          operationId: akupleOp.id,
          itemCode: l.itemCode,
          itemName: l.itemName,
          quantity: l.quantity, // ✅ per-unit
          uomName: l.uomName ?? null,
          warehouseCode: l.warehouseCode ?? null,
          issueMethod: l.issueMethod ?? null,
          lineNo: l.lineNo ?? idx,

          // seçimler unit tablosunda tutulacak
          selectedItemCode: null,
          selectedItemName: null,
          selectedWarehouseCode: null,
          selectedQuantity: null,
          isAlternative: false,
          sapIssueDocEntry: null,
        }));

      await tx.productionOperationItem.createMany({ data: opItemsData });

      // 6) ✅ AKUPLE operationUnit aç
      if (units.length) {
        await tx.productionOperationUnit.createMany({
          data: units.map((u) => ({
            operationId: akupleOp.id,
            unitId: u.id,
            status: 'waiting',
          })),
          skipDuplicates: true,
        });
      }

      const finalUnitCount = await tx.productionOrderUnit.count({
        where: { orderId: order.id },
      });

      return { ...order, unitCount: finalUnitCount, akupleOpId: akupleOp.id };
    });
  }

  async getOperationsByStageCode(stageCode: string) {
    return this.prisma.productionOperation.findMany({
      where: {
        stageCode,
        status: { in: ['waiting', 'in_progress'] },
      },
      include: {
        order: true,
        items: true,
      },
      orderBy: [{ sequenceNo: 'asc' }, { id: 'asc' }],
    });
  }

  // tx: Prisma.TransactionClient gibi düşün (any bırakabilirsin)
  async allocateNextProductionSerial(tx: any): Promise<string> {
    const settingName = 'productionSerial';

    // 🔒 aynı transaction içinde row lock
    const rows = await tx.$queryRaw<
      { id: number; settings: any }[]
    >`SELECT id, settings FROM "Setting" WHERE name = ${settingName} FOR UPDATE`;

    if (!rows.length) throw new Error(`Setting yok: ${settingName}`);

    const row = rows[0];
    const s = row.settings as { prefix: string; pad: number; next: number };

    const prefix = String(s.prefix ?? '').trim();
    const pad = Number(s.pad);
    const next = Number(s.next);

    if (!prefix) throw new Error('productionSerial.prefix missing');
    if (!Number.isFinite(pad) || pad <= 0)
      throw new Error('productionSerial.pad invalid');
    if (!Number.isFinite(next) || next <= 0)
      throw new Error('productionSerial.next invalid');

    const serialNo = `${prefix}${String(next).padStart(pad, '0')}`;

    await tx.setting.update({
      where: { id: row.id },
      data: { settings: { ...row.settings, next: next + 1 } },
    });

    return serialNo;
  }

  async sendLineToProduction(line: {
    sapDocEntry: number;
    sapDocNum: number;
    itemCode: string;
    itemName: string;
    quantity: number;
  }) {
    const itemCode = String(line.itemCode ?? '').trim();
    const qty = Number(line.quantity ?? 0);

    if (!Number.isFinite(qty) || qty <= 0) throw new Error('quantity invalid');
    if (!Number.isInteger(qty))
      throw new Error(`quantity must be integer, got=${qty}`);

    if (!itemCode.startsWith('6.')) {
      throw new Error(`Seri sadece 6.* bitmiş ürün için: ${itemCode}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.create({
        data: {
          sapDocEntry: line.sapDocEntry,
          sapDocNum: line.sapDocNum,
          itemCode,
          itemName: line.itemName,
          quantity: qty,
          status: 'planned',
        },
      });

      const serialNos: string[] = [];

      for (let i = 0; i < qty; i++) {
        const serialNo = await this.allocateNextProductionSerial(tx);

        const created = await tx.productionOrderUnit.create({
          data: {
            orderId: order.id,
            serialNo,
            status: 'planned',
          },
        });

        serialNos.push(created.serialNo);
      }

      // ✅ ekstra garanti (debug istersen kalsın)
      const unitCount = await tx.productionOrderUnit.count({
        where: { orderId: order.id },
      });
      if (unitCount !== qty) {
        throw new Error(
          `unit insert mismatch. expected=${qty} got=${unitCount}`,
        );
      }

      return {
        orderId: order.id,
        createdUnits: serialNos.length,
        serialNos,
        unitCount,
      };
    });
  }

  async backfillUnitsForOrder(orderId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        select: { id: true, quantity: true },
      });
      if (!order) throw new Error('order not found');

      const existing = await tx.productionOrderUnit.count({
        where: { orderId: order.id },
      });

      const missing = order.quantity - existing;
      if (missing <= 0) return { orderId, created: 0, existing };

      const unitsData: { orderId: number; serialNo: string; status: string }[] =
        [];

      for (let i = 0; i < missing; i++) {
        const serialNo = await this.getNextProductionSerial();
        unitsData.push({ orderId: order.id, serialNo, status: 'planned' });
      }

      await tx.productionOrderUnit.createMany({ data: unitsData });

      return { orderId, created: missing, existing };
    });
  }

  private async getOperationIdByStageCode(
    tx: Prisma.TransactionClient,
    orderId: number,
    stageCode: string,
  ) {
    const want = this.normalizeStageCode(stageCode);

    const op = await tx.productionOperation.findFirst({
      where: {
        orderId,
        OR: [
          { stageCode: stageCode }, // raw
          { stageCode: want }, // normalized
        ],
      },
      select: { id: true, stageCode: true },
    });

    if (!op) {
      this.logger.warn(
        `[getOperationIdByStageCode] NOT FOUND orderId=${orderId} stageCode=${stageCode} want=${want}`,
      );
      return null;
    }

    return op.id;
  }

  private async openUnitForStage(
    tx: Prisma.TransactionClient,
    operationId: number,
    unitId: number,
  ) {
    return tx.productionOperationUnit.upsert({
      where: { operationId_unitId: { operationId, unitId } },
      update: {
        // zaten varsa “waiting”e çek (istersen dokunma)
        status: 'waiting',
        startedAt: null,
        finishedAt: null,
        pausedAt: null,
      },
      create: {
        operationId,
        unitId,
        status: 'waiting',
      },
    });
  }

  private async isAllDoneInStages(
    tx: Prisma.TransactionClient,
    unitId: number,
    orderId: number,
    stageCodes: string[],
  ) {
    const wanted = stageCodes.map((s) => this.normalizeStageCode(s));

    const ops = await tx.productionOperation.findMany({
      where: {
        orderId,
        stageCode: { in: [...stageCodes, ...wanted] },
      },
      select: { id: true, stageCode: true },
    });

    if (ops.length === 0) return false;

    const opIds = ops.map((o) => o.id);

    const doneCount = await tx.productionOperationUnit.count({
      where: {
        unitId,
        operationId: { in: opIds },
        status: 'done',
      },
    });

    // stageCodes sayısı kadar done bekliyoruz
    return doneCount >= stageCodes.length;
  }

  private normStageCode(code: string) {
    return String(code ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private async ensureOperation(
    tx: any,
    orderId: number,
    stageCode: string,
    defaults: {
      stageName: string;
      sequenceNo: number;
      departmentCode?: string | null;
    },
  ) {
    const code = this.normStageCode(stageCode);

    const existing = await tx.productionOperation.findFirst({
      where: { orderId, stageCode: code },
      select: { id: true },
    });

    if (existing) return existing.id;

    const created = await tx.productionOperation.create({
      data: {
        orderId,
        stageCode: code,
        stageName: defaults.stageName,
        sequenceNo: defaults.sequenceNo,
        departmentCode: defaults.departmentCode ?? 'GENEL',
        status: 'waiting',
      },
      select: { id: true },
    });

    return created.id;
  }

  async finishOperationUnit(
    operationId: number,
    unitId: number,
    userId?: number,
  ) {
    if (!operationId || Number.isNaN(operationId))
      throw new BadRequestException('invalid operationId');
    if (!unitId || Number.isNaN(unitId))
      throw new BadRequestException('invalid unitId');

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productionOperationUnit.findUnique({
        where: { operationId_unitId: { operationId, unitId } },
        include: {
          operation: { select: { id: true, stageCode: true, orderId: true } },
        },
      });

      if (!row) throw new NotFoundException('operationUnit not found');
      if (row.status === 'done') return row;

      const updated = await tx.productionOperationUnit.update({
        where: { operationId_unitId: { operationId, unitId } },
        data: {
          status: 'done',
          finishedAt: new Date(),
          lastActionByUserId: userId ?? null, // ✅
        },
      });

      await tx.productionOperationUnitLog.create({
        data: {
          operationUnitId: row.id,
          action: 'finish',
          userId: userId ?? null,
        },
      });

      const stageCode = row.operation.stageCode;
      const orderId = row.operation.orderId;
      this.logger.log(
        `[finishOperationUnit] stageCode=${stageCode} orderId=${orderId} unitId=${unitId}`,
      );

      // ✅ AKUPLE bitti -> MOTOR + PANO aynı anda aç
      if (stageCode === 'AKUPLE') {
        const motorOpId = await this.ensureOperation(
          tx,
          orderId,
          'MOTOR_MONTAJ',
          {
            stageName: 'MOTOR MONTAJ',
            sequenceNo: 20,
            departmentCode: 'MOTOR',
          },
        );

        const panoOpId = await this.ensureOperation(
          tx,
          orderId,
          'PANO_TESISAT',
          {
            stageName: 'PANO VE TESİSAT',
            sequenceNo: 30,
            departmentCode: 'TESISAT',
          },
        );

        this.logger.log(
          `[finishOperationUnit] ensured motorOpId=${motorOpId} panoOpId=${panoOpId}`,
        );

        await this.openUnitForStage(tx, motorOpId, unitId);
        await this.openUnitForStage(tx, panoOpId, unitId);

        return updated;
      }

      // ✅ MOTOR veya PANO bitti -> ikisi de done ise KABİN aç
      if (stageCode === 'MOTOR_MONTAJ' || stageCode === 'PANO_TESISAT') {
        const allDone = await this.isAllDoneInStages(tx, unitId, orderId, [
          'MOTOR_MONTAJ',
          'PANO_TESISAT',
        ]);

        if (allDone) {
          const kabinOpId = await this.ensureOperation(
            tx,
            orderId,
            'KABIN_GIYDIRME',
            {
              stageName: 'KABİN GİYDİRME',
              sequenceNo: 50,
              departmentCode: 'KABIN',
            },
          );
          await this.openUnitForStage(tx, kabinOpId, unitId);
        }

        return updated;
      }

      // ✅ KABİN -> TEST
      if (stageCode === 'KABIN_GIYDIRME') {
        const testOpId = await this.getOperationIdByStageCode(
          tx,
          orderId,
          'TEST',
        );
        if (testOpId) await this.openUnitForStage(tx, testOpId, unitId);
        return updated;
      }

      // ✅ TEST -> FINAL (sende FINAL stageCode neyse onu kullan)
      if (stageCode === 'TEST') {
        const finalOpId = await this.getOperationIdByStageCode(
          tx,
          orderId,
          'FINAL',
        );
        if (finalOpId) await this.openUnitForStage(tx, finalOpId, unitId);
        return updated;
      }

      return updated;
    });
  }

  async createProductionOrder(
    dto: CreateProductionOrderDto,
    payload: {
      routeStages: {
        stageId: number | null;
        stageName: string;
        stageCodeRaw?: string;
        visOrder: number;
      }[];
      items: {
        itemCode: string;
        itemName: string | null;
        quantity: number;
        whsCode: string | null;
        issueMethod: string | null;
        stageId: number | null;
        visOrder: number;
      }[];
      lineMeta?: { lineNum: number; whsCode: string };
    },
  ) {
    const sapDocEntry = dto.docEntry != null ? Number(dto.docEntry) : null;
    const sapDocNum = dto.docNum != null ? Number(dto.docNum) : null;

    const itemCode = String(dto.itemCode ?? '').trim();
    const itemName = String(dto.itemName ?? '').trim();
    const quantity = Number(dto.quantity);

    if (!itemCode) throw new BadRequestException('itemCode zorunlu');
    if (!itemName) throw new BadRequestException('itemName zorunlu');
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new BadRequestException('quantity 0 olamaz');
    if (!Number.isInteger(quantity))
      throw new BadRequestException(`quantity integer olmalı. got=${quantity}`);

    const shouldHaveSerial = itemCode.startsWith('6.');

    return this.prisma.$transaction(async (tx) => {
      // 1) idempotent order
      const existing = await tx.productionOrder.findFirst({
        where: {
          ...(sapDocEntry ? { sapDocEntry } : {}),
          ...(sapDocNum && !sapDocEntry ? { sapDocNum } : {}),
          itemCode,
          status: { not: 'cancelled' },
        },
        select: { id: true },
      });

      const order = existing
        ? await tx.productionOrder.update({
            where: { id: existing.id },
            data: {
              sapDocEntry,
              sapDocNum,
              itemCode,
              itemName,
              quantity,
              status: 'planned',
            },
          })
        : await tx.productionOrder.create({
            data: {
              sapDocEntry,
              sapDocNum,
              itemCode,
              itemName,
              quantity,
              status: 'planned',
            },
          });

      // 2) UNITS: quantity kadar unit garanti et
      const currentUnitCount = await tx.productionOrderUnit.count({
        where: { orderId: order.id },
      });

      const needToCreate = shouldHaveSerial
        ? Math.max(0, quantity - currentUnitCount)
        : 0;

      if (shouldHaveSerial && needToCreate > 0) {
        for (let i = 0; i < needToCreate; i++) {
          const serialNo = await this.allocateNextProductionSerial(tx);

          await tx.productionOrderUnit.create({
            data: {
              orderId: order.id,
              serialNo,
              status: 'planned',
            },
          });
        }
      }

      // Units listesi (AKUPLE unit açacağız)
      const units = shouldHaveSerial
        ? await tx.productionOrderUnit.findMany({
            where: { orderId: order.id },
            select: { id: true, serialNo: true, status: true },
            orderBy: { id: 'asc' },
          })
        : [];

      // 3) ROUTE STAGES -> operations oluştur
      const routeStages = Array.isArray(payload?.routeStages)
        ? payload.routeStages
        : [];

      if (!routeStages.length) {
        this.logger.warn(
          `[createProductionOrder] routeStages boş. Sadece order+unit oluşturuldu.`,
        );
        return { ...order, unitCount: units.length };
      }

      function mapStageCodeFromName(stageName: string) {
        const s = String(stageName ?? '')
          .trim()
          .toUpperCase();

        if (s.includes('AKUPLE')) return 'AKUPLE';
        if (s.includes('MOTOR')) return 'MOTOR_MONTAJ';
        if (s.includes('PANO')) return 'PANO_TESISAT';
        if (s.includes('KABIN')) return 'KABIN_GIYDIRME';
        if (s.includes('TEST')) return 'TEST';
        if (s.includes('FONK')) return 'FONK_KALITE';
        if (s.includes('FINAL')) return 'FINAL';

        return null;
      }

      const stageMetas = routeStages
        .map((rs) => {
          if (!rs.stageId) return null;

          const byId = STAGE_MAP_BY_ID[String(rs.stageId)];
          if (!byId) return null;

          return {
            stageId: rs.stageId,
            stageCode: byId.stageCode, // ✅ internal
            stageName: byId.stageName ?? rs.stageName, // ✅ görünen
            sequenceNo: byId.sequenceNo ?? rs.visOrder ?? 0,
            departmentCode: byId.departmentCode ?? null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      this.logger.log(
        `[createProductionOrder] routeStagesIn=${routeStages.length} stageMetas=${stageMetas.length} codes=${JSON.stringify(stageMetas.map((s) => s.stageCode))}`,
      );
      this.logger.log(
        `[createProductionOrder] stageMetas=${JSON.stringify(stageMetas)}`,
      );

      if (!stageMetas.length) {
        this.logger.warn(
          `[createProductionOrder] stageMetas boş! routeStages sample=${JSON.stringify(routeStages.slice(0, 5))}`,
        );
        return { ...order, unitCount: units.length };
      }

      // op upsert + map (stageId->opId, stageCode->opId)
      const opIdByStageId = new Map<string, number>();
      const opIdByStageCode = new Map<string, number>();

      for (const meta of stageMetas) {
        const opExisting = await tx.productionOperation.findFirst({
          where: { orderId: order.id, stageCode: meta.stageCode },
          select: { id: true },
        });

        const op = opExisting
          ? await tx.productionOperation.update({
              where: { id: opExisting.id },
              data: {
                stageCode: meta.stageCode,
                stageName: meta.stageName,
                sequenceNo: meta.sequenceNo,
                departmentCode: meta.departmentCode ?? 'GENEL',
                status: 'waiting',
              },
            })
          : await tx.productionOperation.create({
              data: {
                orderId: order.id,
                stageCode: meta.stageCode,
                stageName: meta.stageName,
                sequenceNo: meta.sequenceNo,
                departmentCode: meta.departmentCode ?? 'GENEL',
                status: 'waiting',
              },
            });

        if (meta.stageId != null)
          opIdByStageId.set(String(meta.stageId), op.id);
        opIdByStageCode.set(meta.stageCode, op.id);
      }

      // ✅ 3.5) AKUPLE TEMPLATE + AKUPLE OP ITEMS (template yoksa payload.items'tan üret)
      const akupleOpId2 = opIdByStageCode.get('AKUPLE');
      const akupleStageId = STAGE_MAP_BY_ID['1'] ? 1 : null; // (bizde 1=AKUPLE)
      if (akupleOpId2) {
        // 1) template çek
        let template = await tx.akupleItemTemplate.findUnique({
          where: { parentItemCode: itemCode },
          include: { lines: true },
        });

        // 2) template yoksa: payload.items içinden AKUPLE stageId satırlarını alıp template oluştur
        if (!template || !template.lines?.length) {
          const allItems = Array.isArray(payload?.items) ? payload.items : [];

          // AKUPLE kalemleri: stageId=1 (veya stage map ile bul)
          const input = allItems
            .filter((x) => x.stageId === 1) // ✅ AKUPLE stageId
            .sort((a, b) => Number(a.visOrder ?? 0) - Number(b.visOrder ?? 0));

          const linesData = input
            .map((l, idx) => ({
              itemCode: String(l.itemCode ?? '').trim(),
              itemName:
                String(l.itemName ?? '').trim() ||
                String(l.itemCode ?? '').trim(),
              quantity: Number(l.quantity ?? 0) || 0, // ✅ per-unit
              warehouseCode: l.whsCode ? String(l.whsCode) : null,
              issueMethod: l.issueMethod ? String(l.issueMethod) : null,
              lineNo: Number(l.visOrder ?? idx) || idx,
              uomName: null,
            }))
            .filter((x) => x.itemCode && x.quantity > 0);

          if (!linesData.length) {
            this.logger.warn(
              `[AKUPLE TEMPLATE] template yok ve payload.items içinde AKUPLE satırı yok. itemCode=${itemCode}`,
            );
          } else {
            template = await tx.akupleItemTemplate.create({
              data: {
                parentItemCode: itemCode,
                parentItemName: itemName,
                lines: { create: linesData },
              },
              include: { lines: true },
            });
          }
        }

        // 3) template varsa: AKUPLE operation items reset + bas
        if (template?.lines?.length) {
          await tx.productionOperationItem.deleteMany({
            where: { operationId: akupleOpId2 },
          });

          const opItemsData = template.lines
            .sort((a, b) => Number(a.lineNo ?? 0) - Number(b.lineNo ?? 0))
            .map((l, idx) => ({
              operationId: akupleOpId2,
              itemCode: l.itemCode,
              itemName: l.itemName,
              // ⚠️ DİKKAT: productionOperationItem.quantity sende TOTAL kullanıyorsun.
              // AKUPLE ekranında unitQuantity hesaplıyorsun; bu yüzden totalQuantity = orderQty * perUnit:
              quantity: quantity * (Number(l.quantity ?? 0) || 0),
              uomName: l.uomName ?? null,
              warehouseCode: l.warehouseCode ?? null,
              issueMethod: l.issueMethod ?? null,
              lineNo: l.lineNo ?? idx,

              selectedItemCode: null,
              selectedItemName: null,
              selectedWarehouseCode: null,
              selectedQuantity: null,
              isAlternative: false,
              sapIssueDocEntry: null,
            }))
            .filter((x) => x.itemCode && x.quantity > 0);

          if (opItemsData.length) {
            await tx.productionOperationItem.createMany({ data: opItemsData });
          }

          this.logger.log(
            `[AKUPLE TEMPLATE] basıldı. parent=${itemCode} lines=${template.lines.length}`,
          );
        }
      }

      // // 4) ITEMS -> ilgili operasyona yaz (stageId ile)
      // // önce tüm operasyon itemlerini temizle (idempotent için)
      // const allOpIds = Array.from(opIdByStageCode.values());
      // if (allOpIds.length) {
      //   await tx.productionOperationItem.deleteMany({
      //     where: { operationId: { in: allOpIds } },
      //   });
      // }

      // // items’i operationId’ye grupla
      // const items = Array.isArray(payload?.items) ? payload.items : [];
      // const itemsByOpId = new Map<number, any[]>();

      // for (const it of items) {
      //   const sid = it.stageId != null ? String(it.stageId) : null;

      //   // stageId ile bulamazsak GENEL/AKUPLE’ye at (senin tercihin)
      //   const opId =
      //     (sid && opIdByStageId.get(sid)) ??
      //     opIdByStageCode.get('AKUPLE') ??
      //     allOpIds[0];

      //   if (!opId) continue;

      //   const arr = itemsByOpId.get(opId) ?? [];
      //   arr.push(it);
      //   itemsByOpId.set(opId, arr);
      // }

      // for (const [opId, arr] of itemsByOpId.entries()) {
      //   const itemsData = arr
      //     .sort((a, b) => Number(a.visOrder ?? 0) - Number(b.visOrder ?? 0))
      //     .map((l, idx) => {
      //       const bomItemCode = String(l.itemCode ?? '').trim();
      //       const bomItemName = String(l.itemName ?? '').trim() || bomItemCode;

      //       // l.quantity zaten BOM satırındaki miktar (1 set için)
      //       // order qty kadar çarp
      //       const requiredQty = quantity * (Number(l.quantity ?? 0) || 0);

      //       return {
      //         operationId: opId,
      //         itemCode: bomItemCode,
      //         itemName: bomItemName,
      //         quantity: requiredQty,
      //         uomName: null, // sende uomName yok payload’da, istersen ekleriz
      //         warehouseCode: l.whsCode ? String(l.whsCode) : null,
      //         issueMethod: l.issueMethod ? String(l.issueMethod) : null,
      //         lineNo: Number(l.visOrder ?? idx) || idx,
      //       };
      //     })
      //     .filter((x) => x.itemCode && x.quantity > 0);

      //   if (itemsData.length) {
      //     await tx.productionOperationItem.createMany({ data: itemsData });
      //   }
      // }

      // 5) ✅ AKUPLE operationUnit’lerini aç (sadece AKUPLE waiting)
      const akupleOpId = opIdByStageCode.get('AKUPLE');
      if (akupleOpId && units.length) {
        await tx.productionOperationUnit.createMany({
          data: units.map((u) => ({
            operationId: akupleOpId,
            unitId: u.id,
            status: 'waiting',
          })),
          skipDuplicates: true,
        });
      }

      const finalUnitCount = await tx.productionOrderUnit.count({
        where: { orderId: order.id },
      });

      return { ...order, unitCount: finalUnitCount };
    });
  }

  async selectAlternativeOnlyAkuple(
    operationId: number,
    unitId: number,
    itemId: number,
    userId: number | null,
    body: {
      isAlternative: boolean;
      selectedItemCode?: string;
      selectedItemName?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
      note?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // item doğrula + BOM bilgisini al
      const item = await tx.productionOperationItem.findFirst({
        where: { id: itemId, operationId },
        select: {
          id: true,
          itemCode: true,
          itemName: true,
          warehouseCode: true,
          quantity: true,
          operation: { select: { stageCode: true } },
        },
      });
      if (!item) throw new BadRequestException('item bulunamadı');
      if (item.operation.stageCode !== 'AKUPLE')
        throw new BadRequestException(
          'Alternatif seçim sadece AKUPLE için yapılabilir',
        );

      // selection upsert (güncel durum)
      const sel = await tx.productionOperationUnitItemSelection.upsert({
        where: { operationId_unitId_itemId: { operationId, unitId, itemId } },
        create: {
          operationId,
          unitId,
          itemId,
          isAlternative: Boolean(body.isAlternative),
          selectedItemCode: body.selectedItemCode ?? null,
          selectedItemName: body.selectedItemName ?? null,
          selectedWarehouseCode: body.selectedWarehouseCode ?? null,
          selectedQuantity: body.selectedQuantity ?? null,
        },
        update: {
          isAlternative: Boolean(body.isAlternative),
          selectedItemCode: body.selectedItemCode ?? null,
          selectedItemName: body.selectedItemName ?? null,
          selectedWarehouseCode: body.selectedWarehouseCode ?? null,
          selectedQuantity: body.selectedQuantity ?? null,
        },
      });

      // log (tarihçe)
      await tx.productionAlternativeLog.create({
        data: {
          operationId,
          unitId,
          itemId,
          bomItemCode: item.itemCode,
          bomItemName: item.itemName,
          bomWhsCode: item.warehouseCode,
          bomQty: item.quantity,
          selectedItemCode: sel.selectedItemCode,
          selectedItemName: sel.selectedItemName,
          selectedWhsCode: sel.selectedWarehouseCode,
          selectedQty: sel.selectedQuantity,
          isAlternative: sel.isAlternative,
          userId: userId ?? null,
          action: body.isAlternative ? 'select' : 'clear',
          note: body.note ?? null,
        },
      });

      return sel;
    });
  }

  async getProductionReportUnits(params: {
    includeFinished?: string;
    search?: string;
  }) {
    const includeFinished = params.includeFinished === '1';
    const search = String(params.search ?? '').trim();

    const whereUnit: any = includeFinished
      ? {}
      : { status: { notIn: ['done', 'completed'] } }; // sende status neyse uyarlarsın

    // basit arama (serial/order/item)
    const whereSearch = search
      ? {
          OR: [
            { serialNo: { contains: search, mode: 'insensitive' } },
            { order: { itemName: { contains: search, mode: 'insensitive' } } },
            { order: { itemCode: { contains: search, mode: 'insensitive' } } },
            { order: { sapDocEntry: Number(search) || undefined } },
          ].filter(Boolean),
        }
      : {};

    const rows = await this.prisma.productionOrderUnit.findMany({
      where: { ...whereUnit, ...whereSearch },
      include: {
        order: true,
        // istersen operationUnits -> en son stage vs çıkarırız
      },
      orderBy: { id: 'desc' },
      take: 500,
    });

    return rows.map((u) => ({
      docEntry: u.order?.sapDocEntry ?? null,
      prodName: u.order?.itemName ?? null,
      u_U_SRN: u.serialNo,
      u_U_SPN: u.order?.sapDocNum ?? u.order?.sapDocEntry ?? null,
      u_U_DURUM: u.status, // planned | in_progress | paused | done
      rotaName: null, // sonra doldururuz
      createDate: u.createdAt,
      lastUser: null,
      lastDurdurmaNedeni: null,
    }));
  }

  async importOrderFromSap(docNum: number) {
    this.logger.log(`[ProductionService] Import order ${docNum} from SAP`);

    // 1) Sipariş başlığı
    const orderHeader = await this.sap.getOrderMainItemByDocNum(docNum);

    if (!orderHeader) {
      throw new Error(
        `SAP'te bu numaraya ait satış siparişi bulunamadı veya satırı yok. (DocNum=${docNum})`,
      );
    }

    this.logger.log(
      `[ProductionService] Order header for ${docNum}: ${JSON.stringify(orderHeader)}`,
    );

    // 2) BOM + Route çek
    // 🔴 Eğer BOM işi SapBomService’teyse bunu kullan:
    // const bomResult = await this.sapBomService.getBomByItemCode(orderHeader.itemCode);
    const bomResult = await this.sap.getBomByItemCode(orderHeader.itemCode);

    const bomLines = bomResult.items ?? []; // ✅ items array
    const routeStages = bomResult.routeStages ?? []; // ✅ stages array

    this.logger.log(
      `[ProductionService] BOM items for item ${orderHeader.itemCode}: count=${bomLines.length}`,
    );
    this.logger.log(
      `[ProductionService] Route stages for item ${orderHeader.itemCode}: count=${routeStages.length}`,
    );

    // 3) DTO map (artık camelCase zaten geldiği için çoğu direkt)
    const mappedBomLines = bomLines.map((line: any) => ({
      itemCode: line.itemCode,
      itemName: line.itemName,
      quantity: line.quantity,
      whsCode: line.whsCode,
      uomName: line.uomName,
      issueMethod: line.issueMethod,
      visOrder: line.visOrder,
      stageId: line.stageId, // ITT1.StageID (sende 1..7 gibi geliyor olabilir)
      lineType: line.lineType,
    }));

    const mappedRouteStages = routeStages.map((s: any) => ({
      stageId: s.stageId, // 1..7
      stgEntry: s.stgEntry, // ORST.AbsEntry
      seqNum: s.seqNum,
      stageName: s.stageName,
      stageCodeRaw: s.stageCodeRaw, // "MOTOR MONTAJ" gibi gelebilir
    }));

    return {
      header: orderHeader,
      routeStages: mappedRouteStages,
      bomLines: mappedBomLines,
    };
  }

  async resolveStageByCodeOrName(input: string) {
    const key = (input || '').trim().toUpperCase().replaceAll('_', ' ');

    const s = await this.prisma.setting.findUnique({
      where: { name: 'production_stages' },
    });

    const arr = Array.isArray(s?.settings) ? (s.settings as any[]) : [];
    const norm = (v: any) =>
      String(v || '')
        .trim()
        .toUpperCase()
        .replaceAll('_', ' ');

    return arr.find((x: any) => {
      return (
        norm(x.code) === key ||
        norm(x.name) === key ||
        norm(x.departmentCode) === key
      );
    });
  }

  async importFromOrders(dto: any) {
    const rawOrderIds = dto?.orderIds ?? [];
    const orderIds = rawOrderIds
      .map((x: any) => Number(x))
      .filter((x) => !isNaN(x));

    const result = {
      requestedCount: orderIds.length,
      importedOrders: [] as number[],
      skippedExisting: [] as number[],
      errors: [] as { orderId: number; message: string }[],
    };

    for (const orderId of orderIds) {
      try {
        this.logger.log(
          `[ProductionService] >>> Processing orderId=${orderId}`,
        );

        // 1) Daha önce import edilmiş mi?
        const existing = await this.prisma.productionOrder.findFirst({
          where: {
            OR: [{ sapDocEntry: orderId }, { sapDocNum: orderId }],
          },
        });

        if (existing) {
          this.logger.log(
            `[ProductionService] Order ${orderId} already imported as productionOrder#${existing.id}`,
          );
          result.skippedExisting.push(orderId);
          continue;
        }

        // 2) Sipariş header'ını SAP'ten al (siparişe özgü)
        const header = await this.sap.getOrderMainItemByDocNum(orderId);
        console.log('HEADERRRRRR', header);

        //          {
        //   sapDocEntry: 5080,
        //   sapDocNum: 5080,
        //   itemCode: '6.202300040',
        //   itemName: 'GJR33-MAR 33KVA OTOMATİK KABİNLİ MARANELLO ALTERNATÖRLÜ JENERATÖR SETİ',
        //   quantity: 1
        // }
        if (!header || !header.itemCode) {
          throw new Error(
            `SAP header missing or itemCode empty for orderId=${orderId}`,
          );
        }

        this.logger.log(
          `[ProductionService] Order ${orderId} header: ${JSON.stringify(header)}`,
        );
        console.log(header.itemCode, 'aaaaaaaaaaaaaaaaaaaaaaaa\n\n\n');
        // 3) Üretim ağacını CACHE'li al (itemCode'a özgü)  ✅
        const structureByItem: any = await this.getProductionStructureCached(
          header.itemCode,
        );

        const stages: any[] = structureByItem?.stages || [];

        this.logger.log(
          `[ProductionService] Order ${orderId} stages count: ${stages.length}`,
        );

        this.logger.log(
          `[ProductionService] Order ${orderId} stages detail: ` +
            JSON.stringify(
              stages.map((s) => ({
                code: s.code,
                name: s.name,
                sequenceNo: s.sequenceNo,
                linesCount: (s.lines ?? []).length,
              })),
              null,
              2,
            ),
        );

        // 4) ProductionOrder kaydı
        const order = await this.prisma.productionOrder.create({
          data: {
            sapDocEntry:
              header.sapDocEntry !== undefined ? header.sapDocEntry : orderId,
            sapDocNum:
              header.sapDocNum !== undefined ? header.sapDocNum : orderId,
            itemCode: header.itemCode,
            itemName: header.itemName ?? '',
            quantity: header.quantity ?? 0,
            status: 'planned',
            //  serialNo: await this.getNextProductionSerial(),
          },
        });

        this.logger.log(
          `[ProductionService] Created ProductionOrder#${order.id} for SAP DocNum=${orderId}`,
        );

        // 5) Rota aşamaları
        let defaultSeq = 10;

        for (const stage of stages) {
          const initialStatus = stage.code === 'AKUPLE' ? 'waiting' : 'planned';

          const op = await this.prisma.productionOperation.create({
            data: {
              orderId: order.id,
              stageCode: stage.code,
              stageName: stage.name,
              departmentCode: stage.departmentCode || stage.code,
              sequenceNo:
                stage.sequenceNo !== undefined ? stage.sequenceNo : defaultSeq,
              status: initialStatus,
            },
          });

          this.logger.log(
            `[ProductionService]   Created ProductionOperation#${op.id} (stage=${stage.code}, status=${initialStatus}) for order#${order.id}`,
          );

          defaultSeq += 10;

          const lines: any[] = stage.lines || [];

          // 6) Kalemler
          for (const line of lines) {
            const item = await this.prisma.productionOperationItem.create({
              data: {
                operationId: op.id,
                itemCode: line.itemCode || '',
                itemName: line.itemName ?? '',
                quantity: line.quantity ?? 0,
                uomName: line.uomName ?? '',
                warehouseCode: line.warehouseCode ?? '',
                issueMethod: line.issueMethod ?? '',
                lineNo: line.lineNo ?? 0,
              },
            });

            this.logger.log(
              `[ProductionService]     Created ProductionOperationItem#${item.id} (${line.itemCode})`,
            );
          }
        }

        result.importedOrders.push(orderId);
        this.logger.log(
          `[ProductionService] <<< Order ${orderId} imported successfully`,
        );
      } catch (err: any) {
        const msg = err?.message || String(err);
        this.logger.error(
          `[ProductionService] Order ${orderId} import failed: ${msg}`,
          err?.stack,
        );
        result.errors.push({ orderId, message: msg });
      }
    }

    this.logger.log(
      `[ProductionService] importFromOrders result: ${JSON.stringify(result)}`,
    );

    return result;
  }

  async ensureOperationUnits(operationId: number) {
    if (!operationId || Number.isNaN(operationId)) return;

    const op = await this.prisma.productionOperation.findUnique({
      where: { id: operationId },
      select: { id: true, orderId: true },
    });
    if (!op) return;

    const units = await this.prisma.productionOrderUnit.findMany({
      where: { orderId: op.orderId },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (units.length === 0) return;

    await this.prisma.productionOperationUnit.createMany({
      data: units.map((u) => ({
        operationId: op.id,
        unitId: u.id,
        status: 'waiting',
      })),
      skipDuplicates: true,
    });
  }

  async startOperationUnit(
    operationId: number,
    unitId: number,
    userId: number,
  ) {
    if (!operationId || Number.isNaN(operationId)) {
      throw new BadRequestException('invalid operationId');
    }
    if (!unitId || Number.isNaN(unitId)) {
      throw new BadRequestException('invalid unitId');
    }

    await this.ensureOperationUnits(operationId);

    const row = await this.prisma.productionOperationUnit.findUnique({
      where: { operationId_unitId: { operationId, unitId } },
      select: { id: true, status: true, startedAt: true, finishedAt: true },
    });

    if (!row) throw new NotFoundException('operationUnit not found');
    if (row.status === 'done' || row.finishedAt) {
      throw new BadRequestException('unit already finished');
    }
    if (row.status === 'paused') {
      throw new BadRequestException('unit is paused (resume first)');
    }
    if (row.status === 'in_progress') {
      // idempotent istersen direkt row dönebilirsin
      return row;
    }

    const now = new Date();

    const updated = await this.prisma.productionOperationUnit.update({
      where: { operationId_unitId: { operationId, unitId } },
      data: {
        status: 'in_progress',
        startedAt: row.startedAt ?? now,
        lastActionByUserId: userId ?? null,
      },
    });

    await this.prisma.productionOperationUnitLog.create({
      data: {
        operationUnitId: row.id,
        action: 'start',
        userId,
      },
    });

    return updated;
  }

  async pauseOperationUnit(
    operationId: number,
    unitId: number,
    dto: { reason: string; note?: string | null },
    userId,
  ) {
    if (!dto?.reason) {
      throw new BadRequestException('reason required');
    }

    const unit = await this.prisma.productionOperationUnit.findUnique({
      where: {
        operationId_unitId: {
          operationId,
          unitId,
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('operation unit not found');
    }

    if (unit.status !== 'in_progress') {
      throw new BadRequestException('unit is not in progress');
    }

    const now = new Date();

    await this.prisma.productionOperationUnit.update({
      where: {
        operationId_unitId: {
          operationId,
          unitId,
        },
      },
      data: {
        status: 'paused',
        pausedAt: now,
        lastActionByUserId: userId ?? null,
      },
    });

    await this.prisma.productionOperationUnitLog.create({
      data: {
        operationUnitId: unit.id,
        action: 'pause',
        reason: dto.reason,
        note: dto.note ?? null,
        userId,
      },
    });

    return { ok: true };
  }

  async resumeOperationUnit(
    operationId: number,
    unitId: number,
    userId: number,
  ) {
    const unit = await this.prisma.productionOperationUnit.findUnique({
      where: {
        operationId_unitId: {
          operationId,
          unitId,
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('operation unit not found');
    }

    if (unit.status !== 'paused' || !unit.pausedAt) {
      throw new BadRequestException('unit is not paused');
    }

    const now = new Date();
    const diffSec = Math.floor(
      (now.getTime() - unit.pausedAt.getTime()) / 1000,
    );

    await this.prisma.productionOperationUnit.update({
      where: {
        operationId_unitId: {
          operationId,
          unitId,
        },
      },
      data: {
        status: 'in_progress',
        pausedAt: null,
        pausedTotalSec: { increment: diffSec },
        lastActionByUserId: userId ?? null,
      },
    });

    await this.prisma.productionOperationUnitLog.create({
      data: {
        operationUnitId: unit.id,
        action: 'resume',
        userId,
      },
    });

    return { ok: true };
  }

  async getStageOperationsAsUnits(params: {
    orderId?: number;
    stageCode?: string;
  }) {
    const { orderId, stageCode } = params;

    const whereOp: any = {};
    if (stageCode) whereOp.stageCode = stageCode;
    if (orderId) whereOp.orderId = orderId;

    const ops = await this.prisma.productionOperation.findMany({
      where: whereOp,
      include: {
        order: {
          include: {
            units: { select: { id: true, serialNo: true, status: true } },
          },
        },
        operationUnits: {
          select: {
            id: true,
            unitId: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            pausedAt: true,
            pausedTotalSec: true,
            updatedAt: true,
            lastActionByUserId: true,
            lastActionByUser: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        items: {
          select: {
            id: true,
            operationId: true,
            itemCode: true,
            itemName: true,
            uomName: true,
            warehouseCode: true,
            issueMethod: true,
            lineNo: true,
            quantity: true,

            selectedItemCode: true,
            selectedItemName: true,
            selectedWarehouseCode: true,
            selectedQuantity: true,

            isAlternative: true,
            sapIssueDocEntry: true,
          },
          orderBy: { lineNo: 'asc' }, // istersen
        },
      },
      orderBy: [{ id: 'desc' }],
      take: 200,
    });

    return this.mapOperationsAsUnits(ops);
  }

  // ProductionService içinde (private yapabilirsin)
  private mapOperationsAsUnits(
    ops: Array<{
      id: number;
      orderId: number;
      stageCode: string;
      stageName: string;
      status: string;

      order?: {
        id: number;
        sapDocEntry: number | null;
        sapDocNum: number | null;
        itemCode: string;
        itemName: string;
        quantity: number;
        status: string;
        units?: Array<{ id: number; serialNo: string; status: string }>;
      } | null;

      operationUnits: Array<{
        id: number;
        unitId: number;
        status: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        pausedAt: Date | null;
        pausedTotalSec: number;
        updatedAt?: Date;
        lastActionByUserId?: number | null;
        lastActionByUser?: {
          id: number;
          fullName: string | null;
          email: string | null;
        } | null;
      }>;

      items?: Array<{
        id: number;
        operationId: number;
        itemCode: string;
        itemName: string | null;
        uomName: string | null;
        warehouseCode: string | null;
        issueMethod: string | null;
        lineNo: number | null;
        quantity: number;
        selectedItemCode: string | null;
        selectedItemName: string | null;
        selectedWarehouseCode: string | null;
        selectedQuantity: number | null;
        isAlternative: boolean;
        sapIssueDocEntry: number | null;
      }>;
    }>,
  ) {
    return (ops ?? []).flatMap((op) => {
      const orderQty = Number(op.order?.quantity ?? 1) || 1;
      const units = op.order?.units ?? [];

      const ouByUnitId = new Map<number, (typeof op.operationUnits)[number]>(
        (op.operationUnits ?? []).map((x) => [x.unitId, x]),
      );

      return units
        .map((u) => {
          const ou = ouByUnitId.get(u.id);
          if (!ou) return null; // ✅ açılmadıysa hiç dönme

          return {
            unitId: u.id,
            serialNo: u.serialNo,

            unitStatus: ou.status,
            operationUnitId: ou.id,

            operationId: op.id,
            stageCode: op.stageCode,
            stageName: op.stageName,
            operationStatus: op.status,

            startedAt: ou.startedAt ?? null,
            finishedAt: ou.finishedAt ?? null,
            pausedAt: ou.pausedAt ?? null,
            pausedTotalSec: ou.pausedTotalSec ?? 0,

            // ✅ UI için
            updatedAt: (ou as any).updatedAt ?? null,
            lastActionByUserId: (ou as any).lastActionByUserId ?? null,
            lastActionByUser: (ou as any).lastActionByUser ?? null,

            orderId: op.orderId,
            order: {
              id: op.order?.id,
              sapDocEntry: op.order?.sapDocEntry ?? null,
              sapDocNum: op.order?.sapDocNum ?? null,
              itemCode: op.order?.itemCode,
              itemName: op.order?.itemName,
              quantity: op.order?.quantity,
              status: op.order?.status,
            },

            items: (op.items ?? []).map((it) => ({
              id: it.id,
              operationId: it.operationId,
              itemCode: it.itemCode,
              itemName: it.itemName,
              uomName: it.uomName ?? null,
              warehouseCode: it.warehouseCode ?? null,
              issueMethod: it.issueMethod ?? null,
              lineNo: it.lineNo ?? null,

              totalQuantity: it.quantity,
              unitQuantity: orderQty ? it.quantity / orderQty : it.quantity,

              selectedItemCode: it.selectedItemCode ?? null,
              selectedItemName: it.selectedItemName ?? null,
              selectedWarehouseCode: it.selectedWarehouseCode ?? null,
              selectedQuantity: it.selectedQuantity ?? null,

              isAlternative: it.isAlternative ?? false,
              sapIssueDocEntry: it.sapIssueDocEntry ?? null,
            })),
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    });
  }

  async selectItemForOperationUnitLine(
    operationId: number,
    unitId: number,
    itemId: number,
    body: {
      useAlternative: boolean;
      selectedItemCode?: string;
      selectedItemName?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
      isAlternative?: boolean;
    },
  ) {
    if (!Number.isFinite(operationId) || operationId <= 0) {
      throw new BadRequestException('operationId geçersiz');
    }
    if (!Number.isFinite(unitId) || unitId <= 0) {
      throw new BadRequestException('unitId geçersiz');
    }
    if (!Number.isFinite(itemId) || itemId <= 0) {
      throw new BadRequestException('itemId geçersiz');
    }

    const useAlt = Boolean(body?.useAlternative);

    // güvenli trim
    const selectedItemCode = body?.selectedItemCode
      ? String(body.selectedItemCode).trim()
      : null;

    const selectedItemName = body?.selectedItemName
      ? String(body.selectedItemName).trim()
      : null;

    const selectedWarehouseCode = body?.selectedWarehouseCode
      ? String(body.selectedWarehouseCode).trim()
      : null;

    const selectedQuantity =
      body?.selectedQuantity == null ? null : Number(body.selectedQuantity);

    if (useAlt) {
      if (!selectedItemCode) {
        throw new BadRequestException('selectedItemCode zorunlu');
      }
      if (!selectedWarehouseCode) {
        throw new BadRequestException('selectedWarehouseCode zorunlu');
      }
      if (selectedQuantity != null && !Number.isFinite(selectedQuantity)) {
        throw new BadRequestException('selectedQuantity geçersiz');
      }
      if (selectedQuantity != null && selectedQuantity < 0) {
        throw new BadRequestException('selectedQuantity 0’dan küçük olamaz');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // referans kayıtlar var mı? (opsiyonel ama iyi)
      const [op, unit, item] = await Promise.all([
        tx.productionOperation.findUnique({
          where: { id: operationId },
          select: { id: true },
        }),
        tx.productionOrderUnit.findUnique({
          where: { id: unitId },
          select: { id: true },
        }),
        tx.productionOperationItem.findUnique({
          where: { id: itemId },
          select: { id: true, operationId: true },
        }),
      ]);

      if (!op) throw new NotFoundException('Operation bulunamadı');
      if (!unit) throw new NotFoundException('Unit bulunamadı');
      if (!item) throw new NotFoundException('Item bulunamadı');
      if (item.operationId !== operationId) {
        throw new BadRequestException(
          `itemId=${itemId} bu operationId=${operationId} için değil`,
        );
      }

      // useAlternative=false => seçimi kaldır (orijinale dön)
      if (!useAlt) {
        await tx.productionOperationUnitItemSelection.deleteMany({
          where: { operationId, unitId, itemId },
        });

        return {
          ok: true,
          removed: true,
          operationId,
          unitId,
          itemId,
        };
      }

      // useAlternative=true => upsert
      const saved = await tx.productionOperationUnitItemSelection.upsert({
        where: {
          operationId_unitId_itemId: { operationId, unitId, itemId },
        },
        create: {
          operationId,
          unitId,
          itemId,
          selectedItemCode,
          selectedItemName,
          selectedWarehouseCode,
          selectedQuantity,
          isAlternative: body?.isAlternative ?? true,
        },
        update: {
          selectedItemCode,
          selectedItemName,
          selectedWarehouseCode,
          selectedQuantity,
          isAlternative: body?.isAlternative ?? true,
        },
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              itemName: true,
              quantity: true,
              warehouseCode: true,
              issueMethod: true,
              lineNo: true,
            },
          },
        },
      });

      return { ok: true, removed: false, saved };
    });
  }

  async getQueueForDepartment(departmentCode: string) {
    return this.prisma.productionOperation.findMany({
      where: {
        departmentCode,
        status: { in: ['waiting', 'in_progress'] },
      },
      orderBy: [{ sequenceNo: 'asc' }, { id: 'asc' }],
      include: {
        order: true,
      },
    });
  }

  async getOperations(stageCode: string) {
    const normalizedStageCode = (stageCode || '').trim().toUpperCase();

    const operations = await this.prisma.productionOperation.findMany({
      where: { stageCode: normalizedStageCode },
      include: {
        order: true,
        items: { orderBy: { lineNo: 'asc' } },
      },
      orderBy: [{ orderId: 'asc' }, { id: 'asc' }],
    });

    return operations;
  }

  async getOperationDetail(operationId: number) {
    console.log(operationId, '/n/n\n\n\n ', operationId);
    return this.prisma.productionOperation.findUnique({
      where: { id: operationId },
      include: {
        order: true,
        items: true,
      },
    });
  }

  async startOperation(operationId: number, userId?: number) {
    return this.prisma.productionOperation.update({
      where: { id: operationId },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
        // istersen responsableUserId alanı ekleyip userId set edebilirsin
      },
    });
  }

  // async finishOperation(operationId: number) {
  //   return this.prisma.productionOperation.update({
  //     where: { id: operationId },
  //     data: {
  //       status: 'done',
  //       finishedAt: new Date(),
  //     },
  //   });
  // }

  private async handleOperationCompletion(op: {
    id: number;
    orderId: number;
    stageCode: string;
  }) {
    const orderId = op.orderId;

    // 1) AKUPLE bittiyse → MOTOR + TESİSAT aç
    if (op.stageCode === 'AKUPLE') {
      await this.prisma.productionOperation.updateMany({
        where: {
          orderId,
          stageCode: { in: ['MOTOR_MONTAJ', 'PANO_TESISAT'] },
          status: 'planned', // henüz sıraya alınmamış olanlar
        },
        data: {
          status: 'waiting',
        },
      });
      return;
    }

    // 2) MOTOR veya TESİSAT bitti ise:
    //    İkisinin de 'done' olup olmadığına bak → öyleyse KABİN'i aç
    if (op.stageCode === 'MOTOR_MONTAJ' || op.stageCode === 'PANO_TESISAT') {
      const siblings = await this.prisma.productionOperation.findMany({
        where: {
          orderId,
          stageCode: { in: ['MOTOR_MONTAJ', 'PANO_TESISAT'] },
        },
        select: {
          id: true,
          stageCode: true,
          status: true,
        },
      });

      const allDone =
        siblings.length > 0 && siblings.every((s) => s.status === 'done');

      if (allDone) {
        await this.prisma.productionOperation.updateMany({
          where: {
            orderId,
            stageCode: 'KABIN_GIYDIRME',
            status: 'planned',
          },
          data: {
            status: 'waiting',
          },
        });
      }

      return;
    }

    // 3) KABİN bittiyse → TEST'i aç
    if (op.stageCode === 'KABIN_GIYDIRME') {
      await this.prisma.productionOperation.updateMany({
        where: {
          orderId,
          stageCode: 'TEST',
          status: 'planned',
        },
        data: {
          status: 'waiting',
        },
      });
    }
  }

  private async createOperationsFromBom(
    orderId: number,
    orderQty: number,
    bomLines: any[],
  ) {
    // StageId -> lines
    const groupMap = new Map<string, any[]>();

    for (const l of bomLines) {
      const stageId = String(l.StageId ?? l.StageID ?? '').trim() || 'GENEL';
      const arr = groupMap.get(stageId) ?? [];
      arr.push(l);
      groupMap.set(stageId, arr);
    }

    for (const [stageId, stageLines] of groupMap.entries()) {
      const meta = STAGE_MAP[stageId] ?? DEFAULT_STAGE;

      // operation oluştur (idempotent: varsa update, yoksa create)
      const opExisting = await this.prisma.productionOperation.findFirst({
        where: { orderId, stageCode: meta.stageCode },
        select: { id: true },
      });

      const operation = opExisting
        ? await this.prisma.productionOperation.update({
            where: { id: opExisting.id },
            data: {
              stageCode: meta.stageCode,
              stageName: meta.stageName,
              sequenceNo: meta.sequenceNo,
              departmentCode: meta.departmentCode ?? 'GENEL',
              status: 'waiting',
            },
          })
        : await this.prisma.productionOperation.create({
            data: {
              orderId,
              stageCode: meta.stageCode,
              stageName: meta.stageName,
              sequenceNo: meta.sequenceNo,
              departmentCode: meta.departmentCode ?? 'GENEL',
              status: 'waiting',
            },
          });

      // items: önce sil sonra createMany
      await this.prisma.productionOperationItem.deleteMany({
        where: { operationId: operation.id },
      });

      const itemsData = stageLines
        .sort((a, b) => Number(a.VisOrder ?? 0) - Number(b.VisOrder ?? 0))
        .map((l, idx) => {
          const bomItemCode = String(l.ItemCode ?? '').trim();
          const bomItemName = String(l.ItemName ?? '').trim() || bomItemCode;

          const perUnit = Number(l.Quantity ?? 0);
          const requiredQty = orderQty * perUnit;

          return {
            operationId: operation.id,
            itemCode: bomItemCode,
            itemName: bomItemName,
            quantity: requiredQty,
            uomName: l.UomName ? String(l.UomName) : null,
            warehouseCode: l.WhsCode ? String(l.WhsCode) : null,
            issueMethod: l.IssueMethod ? String(l.IssueMethod) : null,
            lineNo: l.VisOrder != null ? Number(l.VisOrder) : idx,
          };
        })
        .filter((x) => x.itemCode);

      if (itemsData.length) {
        await this.prisma.productionOperationItem.createMany({
          data: itemsData,
        });
      }

      this.logger.log(
        `[createOperationsFromBom] orderId=${orderId} stageId=${stageId} stageCode=${meta.stageCode} items=${itemsData.length}`,
      );
    }
  }
  private async createGoodsIssueForOperation(
    op: {
      id: number;
      stageCode: string;
      orderId: number;
      order?: { sapDocNum: number | null; sapDocEntry: number | null };
    },
    lines: { itemCode: string; quantity: number; whsCode?: string | null }[],
  ) {
    if (!lines.length) {
      this.logger.warn(
        `[ProductionService] createGoodsIssueForOperation: op#${op.id} için satır yok, GI atlanıyor.`,
      );
      return;
    }

    const docDate = new Date().toISOString().slice(0, 10);

    const payload = {
      DocDate: docDate,
      Comments: `Üretim operasyonu malzeme çıkışı. OrderId=${op.orderId}, Stage=${op.stageCode}`,
      DocumentLines: lines.map((l) => ({
        ItemCode: l.itemCode,
        Quantity: Number(l.quantity),
        WarehouseCode: l.whsCode || '',
      })),
    };

    this.logger.log(
      `[ProductionService] createGoodsIssueForOperation: op#${op.id}, payload=${JSON.stringify(
        payload,
      )}`,
    );

    try {
      const res = await this.sap.post('InventoryGenExits', payload);
      this.logger.log(
        `[ProductionService] Goods Issue created for op#${op.id}: ${JSON.stringify(
          res,
        )}`,
      );
      return res;
    } catch (err: any) {
      const raw = err?.response?.data || err?.message || String(err);

      this.logger.error(
        `[ProductionService] Goods Issue FAILED for op#${op.id}: ${JSON.stringify(
          raw,
        )}`,
      );

      // 🔴 Özel durum: batch/serial seçimi zorunlu hatası → sadece logla, exception fırlatma
      const msgStr =
        typeof raw === 'string' ? raw : JSON.stringify(raw || {}, null, 2);

      if (
        msgStr.includes(
          'Cannot add row without complete selection of batch/serial numbers',
        ) ||
        msgStr.includes('"code":-4014')
      ) {
        this.logger.warn(
          `[ProductionService] Goods Issue skipped for op#${op.id} (batch/serial zorunlu kalemler var, ileride UI'dan seçilecek).`,
        );
        // HATA YUTULUYOR → finishOperation akışı devam edecek
        return;
      }

      // Diğer hataları aynen dışarı fırlat
      throw err;
    }
  }

  async finishOperation(operationId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Operasyonu ve ilişkili order + item’ları çek
      const op = await tx.productionOperation.findUnique({
        where: { id: operationId },
        include: {
          order: true,
          items: true,
        },
      });

      if (!op) {
        throw new Error('Operasyon bulunamadı');
      }

      if (op.status === 'completed') {
        // iki kere bitir’e basılırsa
        return op;
      }

      // 2) SAP malzeme çıkışı için satırları hazırla
      const issueLines = op.items
        .map((it) => {
          const useAlt = !!it.selectedItemCode && !!it.selectedQuantity;

          const itemCode = useAlt ? it.selectedItemCode! : it.itemCode;
          const quantity = useAlt ? it.selectedQuantity! : it.quantity;
          const whsCode = useAlt
            ? it.selectedWarehouseCode || it.warehouseCode
            : it.warehouseCode;

          return {
            itemCode,
            quantity,
            whsCode,
          };
        })
        // boş / sıfır satırları gönderme
        .filter(
          (l) =>
            !!l.itemCode &&
            l.itemCode.trim() !== '' &&
            l.quantity !== null &&
            l.quantity !== undefined &&
            Number(l.quantity) > 0,
        );

      // 3) SAP’te malzeme çıkışı oluştur (varsa satır)
      if (issueLines.length > 0) {
        try {
          await this.createGoodsIssueForOperation(op, issueLines);
        } catch (giErr: any) {
          // createGoodsIssueForOperation -4014 dışındaki hataları fırlatırsa bile
          // burada da tutup operasyonun tamamlanmasına izin verebilirsin
          this.logger.error(
            `[ProductionService] finishOperation: Goods Issue error for op#${op.id}: ${
              giErr?.message || String(giErr)
            }`,
          );
          // İstersen burada throw giErr dersen tekrar patlar; şimdilik yutuyoruz.
        }
      }

      // 4) Operasyonu tamamla
      const now = new Date();

      const updatedOp = await tx.productionOperation.update({
        where: { id: op.id },
        data: {
          status: 'completed',
          finishedAt: now,
        },
      });

      // 5) Sonraki aşamaları aktifleştirme mantığı

      // AKUPLE bittiyse → MOTOR_MONTAJ + PANO_TESISAT 'waiting' olsun
      if (op.stageCode === 'AKUPLE') {
        await tx.productionOperation.updateMany({
          where: {
            orderId: op.orderId,
            stageCode: { in: ['MOTOR_MONTAJ', 'PANO_TESISAT'] },
            status: 'planned',
          },
          data: {
            status: 'waiting',
          },
        });
      }

      // MOTOR_MONTAJ veya PANO_TESISAT bittiyse → ikisi de tamamlandığında KABIN 'waiting' olsun
      if (['MOTOR_MONTAJ', 'PANO_TESISAT'].includes(op.stageCode)) {
        const siblings = await tx.productionOperation.findMany({
          where: {
            orderId: op.orderId,
            stageCode: { in: ['MOTOR_MONTAJ', 'PANO_TESISAT'] },
          },
          select: {
            id: true,
            stageCode: true,
            status: true,
          },
        });

        const allDone = siblings.every(
          (s) => s.status === 'completed' || s.id === op.id, // transaction içinde olduğumuz için bu satır zaten completed sayılacak
        );

        if (allDone) {
          await tx.productionOperation.updateMany({
            where: {
              orderId: op.orderId,
              stageCode: 'KABIN',
              status: 'planned',
            },
            data: {
              status: 'waiting',
            },
          });
        }
      }

      // KABIN bittiyse → TEST 'waiting' olsun
      if (op.stageCode === 'KABIN') {
        await tx.productionOperation.updateMany({
          where: {
            orderId: op.orderId,
            stageCode: 'TEST',
            status: 'planned',
          },
          data: {
            status: 'waiting',
          },
        });
      }

      return updatedOp;
    });
  }

  // production.service.ts içinde

  async selectItemForOperationLine(
    operationId: number,
    itemId: number,
    body: {
      useAlternative: boolean;
      selectedItemCode?: string;
      selectedItemName?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
    },
  ) {
    const {
      useAlternative,
      selectedItemCode,
      selectedItemName,
      selectedWarehouseCode,
      selectedQuantity,
    } = body;

    // 1) Satırı bul
    const item = await this.prisma.productionOperationItem.findFirst({
      where: {
        id: itemId,
        operationId,
      },
    });

    if (!item) {
      throw new Error('Operation item not found');
    }

    // 2) Eğer orijinal ürüne dönülüyorsa → tüm seçimleri sıfırla
    if (!useAlternative) {
      return this.prisma.productionOperationItem.update({
        where: { id: itemId },
        data: {
          selectedItemCode: null,
          selectedItemName: null,
          selectedWarehouseCode: null,
          selectedQuantity: null,
          isAlternative: false,
        },
      });
    }

    // 3) Alternatif ürün seçiliyorsa → zorunlu bilgileri kontrol et
    if (!selectedItemCode || !selectedQuantity) {
      throw new Error(
        'Alternatif ürün seçerken selectedItemCode ve selectedQuantity zorunludur',
      );
    }

    const whs =
      selectedWarehouseCode && selectedWarehouseCode.trim().length > 0
        ? selectedWarehouseCode
        : item.warehouseCode;

    // 4) DB'de satırı güncelle (SAP yok!)
    const updated = await this.prisma.productionOperationItem.update({
      where: { id: itemId },
      data: {
        selectedItemCode,
        selectedItemName: selectedItemName || selectedItemCode,
        selectedWarehouseCode: whs,
        selectedQuantity,
        isAlternative: selectedItemCode !== item.itemCode, // kodlar farklı ise alternatif
      },
    });

    return updated;
  }
  private stableStringify(obj: any) {
    return JSON.stringify(obj);
  }

  private sha1(str: string) {
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  private async getProductionStructureCached(itemCode: string) {
    // 1) PSQL cache'e bak
    const cached = await this.prisma.productionStructureCache.findUnique({
      where: { itemCode },
    });

    if (cached?.data) {
      return cached.data as any; // { itemCode, stages }
    }

    // 2) Yoksa SAP'ten üret (Senin SapService'te zaten var)
    const structure = await this.sap.buildProductionStructureFromSap(itemCode);

    // 3) Hash
    const hash = this.sha1(this.stableStringify(structure));

    // 4) Cache'e yaz
    await this.prisma.productionStructureCache.upsert({
      where: { itemCode },
      create: { itemCode, data: structure, dataHash: hash },
      update: { data: structure, dataHash: hash },
    });

    return structure;
  }

  async getNextProductionSerial(): Promise<string> {
    const settingName = 'productionSerial';

    return this.prisma.$transaction(async (tx) => {
      // 1) Setting satırını kilitle
      const rows = await tx.$queryRaw<
        { id: number; settings: any }[]
      >`SELECT id, settings FROM "Setting" WHERE name = ${settingName} FOR UPDATE`;

      if (!rows.length) {
        throw new Error('productionSerial setting not found');
      }

      const row = rows[0];
      const { pad, next, prefix } = row.settings as {
        pad: number;
        next: number;
        prefix: string;
      };

      if (!prefix || !Number.isFinite(pad) || !Number.isFinite(next)) {
        throw new Error(
          `productionSerial setting invalid: ${JSON.stringify(row.settings)}`,
        );
      }

      // 2) Seri üret
      const serialNo = `${prefix}${String(next).padStart(pad, '0')}`;

      // 3) next'i arttır
      await tx.setting.update({
        where: { id: row.id },
        data: {
          settings: {
            ...row.settings,
            next: next + 1,
          },
        },
      });

      return serialNo;
    });
  }

  // async pauseOperation(
  //   operationId: number,
  //   dto: { reason: string; note?: string | null },
  // ) {
  //   if (!operationId || Number.isNaN(operationId)) {
  //     throw new BadRequestException('invalid operationId');
  //   }
  //   if (!dto?.reason) {
  //     throw new BadRequestException('reason required');
  //   }

  //   const current = await this.prisma.productionOperation.findUnique({
  //     where: { id: operationId },
  //     select: {
  //       id: true,
  //       status: true,
  //       pausedAt: true,
  //       startedAt: true,
  //       finishedAt: true,
  //     },
  //   });
  //   console.log(current);
  //   if (!current) throw new NotFoundException('operation not found');
  //   if (current.status === 'done') {
  //     throw new BadRequestException('operation already finished');
  //   }
  //   if (current.status === 'paused') {
  //     // İstersen burada "idempotent" dönüp OK diyebilirsin ama ben hata tercih ederim:
  //     throw new BadRequestException('operation already paused');
  //   }

  //   const now = new Date();

  //   const op = await this.prisma.productionOperation.update({
  //     where: { id: operationId },
  //     data: {
  //       status: 'paused',
  //       pausedAt: current.pausedAt ?? now, // ilk kez duruyorsa set et
  //     },
  //   });

  //   // await this.prisma.productionOperationPauseLog.create({
  //   //   data: {
  //   //     operationId,
  //   //     action: 'pause',
  //   //     reason: dto.reason,
  //   //     note: dto.note ?? null,
  //   //     // occurredAt: now, // log tablon varsa eklemek çok iyi olur
  //   //   },
  //   // });

  //   return op;
  // }

  // async resumeOperation(operationId: number, dto?: { note?: string | null }) {
  //   if (!operationId || Number.isNaN(operationId)) {
  //     throw new BadRequestException('invalid operationId');
  //   }

  //   const current = await this.prisma.productionOperation.findUnique({
  //     where: { id: operationId },
  //     select: {
  //       id: true,
  //       status: true,
  //       pausedAt: true,
  //       pausedTotalSec: true,
  //       finishedAt: true,
  //     },
  //   });

  //   if (!current) throw new NotFoundException('operation not found');
  //   if (current.status === 'done') {
  //     throw new BadRequestException('operation already finished');
  //   }
  //   if (current.status !== 'paused') {
  //     throw new BadRequestException('operation is not paused');
  //   }
  //   if (!current.pausedAt) {
  //     throw new BadRequestException('pausedAt missing');
  //   }

  //   const now = new Date();
  //   const diffSec = Math.max(
  //     0,
  //     Math.floor((now.getTime() - current.pausedAt.getTime()) / 1000),
  //   );

  //   const op = await this.prisma.productionOperation.update({
  //     where: { id: operationId },
  //     data: {
  //       status: 'in_progress',
  //       pausedTotalSec: { increment: diffSec },
  //       pausedAt: null,
  //     },
  //   });

  //   // await this.prisma.productionOperationPauseLog.create({
  //   //   data: {
  //   //     operationId,
  //   //     action: 'resume',
  //   //     reason: 'resume', // veya ayrı kolon/enum; istersen null bırak
  //   //     note: dto?.note ?? null,
  //   //     // occurredAt: now
  //   //   },
  //   // });

  //   return op;
  // }

  async getStageOperationsWithUnits(stageCode: string) {
    const code = String(stageCode ?? '')
      .trim()
      .toUpperCase();
    if (!code) return [];

    const includeItems = code === 'AKUPLE';

    const ops = await this.prisma.productionOperation.findMany({
      where: {
        stageCode: code,
        status: { in: ['waiting', 'in_progress', 'paused'] }, // sende status seti neyse
      },
      include: {
        order: true,
        operationUnits: {
          include: {
            unit: { select: { id: true, serialNo: true } },
          },
          orderBy: { unitId: 'asc' },
        },
        ...(includeItems ? { items: { orderBy: { lineNo: 'asc' } } } : {}),
      },
      orderBy: [{ id: 'desc' }],
      take: 200,
    });

    // ensure: her op için unit satırları garanti olsun
    for (const op of ops) {
      await this.ensureOperationUnits(op.id);
    }

    const ops2 = await this.prisma.productionOperation.findMany({
      where: { stageCode: code },
      include: {
        order: true,
        operationUnits: {
          include: { unit: { select: { id: true, serialNo: true } } },
          orderBy: { unitId: 'asc' },
        },
        ...(includeItems ? { items: { orderBy: { lineNo: 'asc' } } } : {}),
      },
      orderBy: [{ id: 'desc' }],
      take: 200,
    });

    return ops2.map((op) => ({
      operationId: op.id,
      stageCode: op.stageCode,
      stageName: op.stageName,
      operationStatus: op.status,
      startedAt: op.startedAt,
      finishedAt: op.finishedAt,
      orderId: op.orderId,
      order: op.order,
      items: includeItems ? op.items : [],
      units: op.operationUnits.map((ou) => ({
        unitId: ou.unitId,
        serialNo: ou.unit?.serialNo,
        unitStatus: ou.status,
        unitStartedAt: ou.startedAt,
        unitFinishedAt: ou.finishedAt,
        pausedTotalSec: ou.pausedTotalSec,
      })),
    }));
  }
}
