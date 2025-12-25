import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Item } from '@prisma/client';
import { ItemsService } from '../items/items.service';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapItems: ItemsService,
  ) {}

  async createMaterialShortageRun(params: {
    dto: any;
    shortages: any[];
  }): Promise<{ id: number }> {
    const run = await this.prisma.materialShortageRun.create({
      data: {
        payload: params.dto,
        shortages: params.shortages,
      },
      select: { id: true },
    });

    return run;
  }

  async createPurchaseRequestFromShortageRun(params: {
    runId: number;
    includeChildren?: boolean;
    note?: string;
  }) {
    const runId = Number(params.runId);
    if (!runId || Number.isNaN(runId)) {
      throw new BadRequestException('runId zorunlu');
    }

    const run = await this.prisma.materialShortageRun.findUnique({
      where: { id: runId },
      select: { id: true, payload: true, shortages: true, createdAt: true },
    });

    if (!run)
      throw new BadRequestException(`MaterialShortageRun bulunamadı: ${runId}`);

    // aynı runId için tekrar basmayı engellemek istersen:
    const existing = await this.prisma.purchaseRequest.findFirst({
      where: { materialRunId: run.id },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, purchaseRequestId: existing.id, alreadyExists: true };
    }

    const payload: any = run.payload ?? {};
    const shortagesRaw: any[] = Array.isArray(run.shortages)
      ? (run.shortages as any[])
      : [];
    const includeChildren = Boolean(params.includeChildren);

    // 1) Main + children kalemleri normalize et
    type TmpItem = {
      itemCode: string;
      whsCode?: string;
      required: number;
      inStock: number;
      missing: number;
      purchaseQty: number;
      parentItemCode?: string;
    };

    const tmpItems: TmpItem[] = [];

    for (const s of shortagesRaw) {
      const itemCode = String(s?.itemCode ?? '').trim();
      const missing = Number(s?.missing ?? 0);
      if (itemCode && missing > 0) {
        tmpItems.push({
          itemCode,
          whsCode: s?.whsCode ? String(s.whsCode) : undefined,
          required: Number(s?.required ?? 0),
          inStock: Number(s?.inStock ?? 0),
          missing,
          purchaseQty: missing,
        });
      }

      if (includeChildren && Array.isArray(s?.children)) {
        const parentItemCode = itemCode; // children’ın parent’ı bu
        for (const c of s.children) {
          const cCode = String(c?.itemCode ?? '').trim();
          const cMissing = Number(c?.missing ?? 0);
          if (cCode && cMissing > 0) {
            tmpItems.push({
              itemCode: cCode,
              whsCode: c?.whsCode ? String(c.whsCode) : undefined,
              required: Number(c?.required ?? 0),
              inStock: Number(c?.inStock ?? 0),
              missing: cMissing,
              purchaseQty: cMissing,
              parentItemCode,
            });
          }
        }
      }
    }

    if (!tmpItems.length) {
      throw new BadRequestException('Satın alma talebi için kalem bulunamadı');
    }

    // 2) ItemName ve ParentItemName için code’ları topla
    const codesSet = new Set<string>();
    for (const it of tmpItems) {
      if (it.itemCode) codesSet.add(it.itemCode);
      if (it.parentItemCode) codesSet.add(it.parentItemCode);
    }
    const codes = [...codesSet];
    this.logger.log(
      `Name lookup codes count=${codes.length} sample=${codes.slice(0, 20).join(',')}`,
    );

    const nameMap = await this.sapItems.getItemNames(codes);
    console.log(nameMap);
    // 3) Header oluştur + items create
    const pr = await this.prisma.purchaseRequest.create({
      data: {
        source: 'MATERIAL_SHORTAGE',
        materialRunId: run.id,

        docEntry: payload.docEntry ?? null,
        sapDocNum: payload.docNum ?? null,
        parentItemCode: payload.itemCode ?? null,
        requestedQty: payload.quantity ?? null,
        whsCode: payload.whsCode ?? null,

        note: params.note ?? null,
        status: 'draft',

        items: {
          create: tmpItems.map((x) => ({
            itemCode: x.itemCode,
            itemName: nameMap.get(x.itemCode) ?? undefined, // ✅ SAP’den
            whsCode: x.whsCode,
            required: x.required,
            inStock: x.inStock,
            missing: x.missing,
            purchaseQty: x.purchaseQty,
            parentItemCode: x.parentItemCode,
            parentItemName: x.parentItemCode
              ? (nameMap.get(x.parentItemCode) ?? undefined) // ✅ SAP’den
              : undefined,
          })),
        },
      },
      select: { id: true },
    });

    this.logger.log(
      `[createPurchaseRequestFromShortageRun] runId=${run.id} prId=${pr.id} items=${tmpItems.length}`,
    );

    return { ok: true, purchaseRequestId: pr.id, itemCount: tmpItems.length };
  }

  async listPurchaseRequestsWithItems(params?: {
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Number(params?.take ?? 50), 200);
    const skip = Number(params?.skip ?? 0);
    const status = (params?.status ?? '').trim();

    const where: any = {};
    if (status) where.status = status;

    const rows = await this.prisma.purchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true, // ✅ detay kalemleri gelsin
      },
    });
    return { ok: true, items: rows };
  }

  async getPurchaseRequestById(id: number) {
    return this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ parentItemCode: 'asc' }, { itemCode: 'asc' }],
        },
      },
    });
  }
}
