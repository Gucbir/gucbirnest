import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';
export type ProductionStageCode =
  | 'AKUPLE'
  | 'MOTOR_MONTAJ'
  | 'PANO_TESISAT'
  | 'TEST'
  | 'KABIN_GIYDIRME';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  async importOrderFromSap(docNum: number) {
    this.logger.log(`[ProductionService] Import order ${docNum} from SAP`);

    // 1) Sipariş başlığı
    const orderHeader = await this.sap.getOrderMainItemByDocNum(docNum);

    if (!orderHeader) {
      throw new Error(
        `SAP'te bu numaraya ait satış siparişi bulunamadı veya satırı yok. (DocNum=${docNum})`,
      );
    }

    // orderHeader.itemCode -> "6.202300040" gibi
    this.logger.log(
      `[ProductionService] Order header for ${docNum}: ${JSON.stringify(orderHeader)}`,
    );

    // 2) BOM satırlarını çek
    const bomResult = await this.sap.getBomByItemCode(orderHeader.itemCode);
    console.log(bomResult, '12222222222222');
    const bomLines = bomResult?.value ?? [];

    this.logger.log(
      `[ProductionService] BOM lines for item ${orderHeader.itemCode}: count=${bomLines.length}`,
    );

    // 3) İstersen burada kendi DTO'nuna map et
    const mappedBomLines = bomLines.map((line: any) => ({
      bomItemCode: line.BomItemCode,
      fatherItemCode: line.FatherItemCode,
      itemCode: line.ItemCode,
      itemName: line.ItemName,
      quantity: line.Quantity,
      whsCode: line.WhsCode,
      uomName: line.UomName,
      issueMethod: line.IssueMethod,
      visOrder: line.VisOrder,
      stageId: line.StageId,
    }));

    // 4) Buradan sonra istersen Prisma ile kaydedebilirsin
    // örnek:
    /*
  await this.prisma.productionOrder.create({
    data: {
      sapDocNum: orderHeader.sapDocNum,
      itemCode: orderHeader.itemCode,
      itemName: orderHeader.itemName,
      quantity: orderHeader.quantity,
      bomLines: {
        createMany: {
          data: mappedBomLines,
        },
      },
    },
  });
  */

    // Şimdilik sadece geriye döndürelim:
    return {
      header: orderHeader,
      bomLines: mappedBomLines,
    };
  }

  /**
   * Açık siparişlerden üretime aktar
   * dto = { orderIds: [123, 124] }
   */
  // async importFromOrders(dto: any) {
  //   // 1) Gelen DTO'dan sipariş numaralarını çek
  //   const rawOrderIds = dto?.orderIds ?? [];
  //   this.logger.log(
  //     `[ProductionService] importFromOrders: raw orderIds = ${JSON.stringify(
  //       rawOrderIds,
  //     )}`,
  //   );

  //   const orderIds = rawOrderIds
  //     .map((x: any) => Number(x))
  //     .filter((x) => !isNaN(x));

  //   this.logger.log(
  //     `[ProductionService] importFromOrders: normalized orderIds = ${JSON.stringify(
  //       orderIds,
  //     )}`,
  //   );

  //   const result = {
  //     requestedCount: orderIds.length,
  //     importedOrders: [] as number[],
  //     skippedExisting: [] as number[],
  //     errors: [] as { orderId: number; message: string }[],
  //   };

  //   for (const orderId of orderIds) {
  //     try {
  //       this.logger.log(
  //         `[ProductionService] >>> Processing orderId=${orderId}`,
  //       );

  //       // 2) Daha önce import edilmiş mi?
  //       const existing = await this.prisma.productionOrder.findFirst({
  //         where: {
  //           OR: [{ sapDocEntry: orderId }, { sapDocNum: orderId }],
  //         },
  //       });

  //       if (existing) {
  //         this.logger.log(
  //           `[ProductionService] Order ${orderId} already imported as productionOrder#${existing.id}`,
  //         );
  //         result.skippedExisting.push(orderId);
  //         continue;
  //       }

  //       // 3) SAP'ten ürün ağacı + rota çek
  //       const structure: any =
  //         await this.sap.getProductionStructureByOrderId(orderId);

  //       const header = structure?.header || null;
  //       const stages: any[] = structure?.stages || [];

  //       this.logger.log(
  //         `[ProductionService] Order ${orderId} header: ${JSON.stringify(
  //           header,
  //         )}`,
  //       );
  //       this.logger.log(
  //         `[ProductionService] Order ${orderId} stages count: ${stages.length}`,
  //       );

  //       if (!header || !header.itemCode) {
  //         throw new Error(
  //           `SAP header missing or itemCode empty for orderId=${orderId}`,
  //         );
  //       }

  //       // 4) ProductionOrder kaydı
  //       const order = await this.prisma.productionOrder.create({
  //         data: {
  //           sapDocEntry:
  //             header.sapDocEntry !== undefined ? header.sapDocEntry : orderId,
  //           sapDocNum:
  //             header.sapDocNum !== undefined ? header.sapDocNum : orderId,
  //           itemCode: header.itemCode,
  //           itemName: header.itemName ?? '',
  //           quantity: header.quantity ?? 0,
  //           status: 'planned',
  //         },
  //       });

  //       this.logger.log(
  //         `[ProductionService] Created ProductionOrder#${order.id} for SAP DocNum=${orderId}`,
  //       );

  //       // 5) Rota aşamaları
  //       let defaultSeq = 10;

  //       for (const stage of stages) {
  //         const op = await this.prisma.productionOperation.create({
  //           data: {
  //             orderId: order.id,
  //             stageCode: stage.code,
  //             stageName: stage.name,
  //             departmentCode: stage.departmentCode || stage.code,
  //             sequenceNo:
  //               stage.sequenceNo !== undefined ? stage.sequenceNo : defaultSeq,
  //             status: 'waiting',
  //           },
  //         });

  //         this.logger.log(
  //           `[ProductionService]   Created ProductionOperation#${op.id} (stage=${stage.code}) for order#${order.id}`,
  //         );

  //         defaultSeq += 10;

  //         const lines: any[] = stage.lines || [];

  //         // 6) Kalemler
  //         for (const line of lines) {
  //           const item = await this.prisma.productionOperationItem.create({
  //             data: {
  //               operationId: op.id,
  //               itemCode: line.itemCode,
  //               itemName: line.itemName ?? '',
  //               quantity: line.quantity ?? 0,
  //               uomName: line.uomName ?? '',
  //               warehouseCode: line.warehouseCode ?? '',
  //               issueMethod: line.issueMethod ?? '',
  //               lineNo: line.lineNo ?? 0,
  //             },
  //           });

  //           this.logger.log(
  //             `[ProductionService]     Created ProductionOperationItem#${item.id} (${line.itemCode})`,
  //           );
  //         }
  //       }

  //       result.importedOrders.push(orderId);
  //       this.logger.log(
  //         `[ProductionService] <<< Order ${orderId} imported successfully`,
  //       );
  //     } catch (err: any) {
  //       const msg = err?.message || String(err);
  //       this.logger.error(
  //         `[ProductionService] Order ${orderId} import failed: ${msg}`,
  //         err?.stack,
  //       );
  //       result.errors.push({
  //         orderId,
  //         message: msg,
  //       });
  //     }
  //   }

  //   this.logger.log(
  //     `[ProductionService] importFromOrders result: ${JSON.stringify(result)}`,
  //   );

  //   return result;
  // }
  async importFromOrders(dto: any) {
    // 1) Gelen DTO'dan sipariş numaralarını çek
    const rawOrderIds = dto?.orderIds ?? [];
    this.logger.log(
      `[ProductionService] importFromOrders: raw orderIds = ${JSON.stringify(
        rawOrderIds,
      )}`,
    );

    const orderIds = rawOrderIds
      .map((x: any) => Number(x))
      .filter((x) => !isNaN(x));

    this.logger.log(
      `[ProductionService] importFromOrders: normalized orderIds = ${JSON.stringify(
        orderIds,
      )}`,
    );

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

        // 2) Daha önce import edilmiş mi?
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

        // 3) SAP'ten ürün ağacı + rota çek
        // ❗❗ ÖNEMLİ: this.sap DEĞİL this.sapService olmalı
        const structure: any =
          await this.sap.getProductionStructureByOrderId(orderId);
        this.logger.log(
          `[ProductionService] Order ${orderId} raw structure: ` +
            JSON.stringify(structure, null, 2),
        );
        const header = structure?.header || null;
        const stages: any[] = structure?.stages || [];

        this.logger.log(
          `[ProductionService] Order ${orderId} header: ${JSON.stringify(
            header,
          )}`,
        );
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
        if (!header || !header.itemCode) {
          throw new Error(
            `SAP header missing or itemCode empty for orderId=${orderId}`,
          );
        }

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
          },
        });

        this.logger.log(
          `[ProductionService] Created ProductionOrder#${order.id} for SAP DocNum=${orderId}`,
        );

        // 5) Rota aşamaları
        let defaultSeq = 10;

        for (const stage of stages) {
          // AKUPLE hemen aktif, diğerleri planned olsun
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
        result.errors.push({
          orderId,
          message: msg,
        });
      }
    }

    this.logger.log(
      `[ProductionService] importFromOrders result: ${JSON.stringify(result)}`,
    );

    return result;
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

  async getOperations(stageCode: ProductionStageCode) {
    // Stage kodu SAP tarafında ne ise onu kullan:
    // AKUPLE, Akuple, AKUPLE1 vs.

    const operations = await this.prisma.productionOperation.findMany({
      where: {
        stageCode,
        status: {
          in: ['waiting', 'in_progress'],
        },
      }, // 🔥 burada filtreyi stageCode ile yapıyoruz
      include: {
        order: true,
        items: true,
      },
      orderBy: [{ order: { sapDocNum: 'asc' } }, { id: 'asc' }],
    });
    return operations.map((op) => ({
      id: op.id,
      stageCode: op.stageCode,
      stageName: op.stageName,
      status: op.status,
      sequenceNo: op.sequenceNo,
      departmentCode: op.departmentCode,
      startedAt: op.startedAt,
      finishedAt: op.finishedAt,

      order: {
        id: op.order.id,
        sapDocNum: op.order.sapDocNum,
        itemCode: op.order.itemCode,
        itemName: op.order.itemName,
        quantity: op.order.quantity,
      },

      items: op.items.map((it) => ({
        id: it.id,
        itemCode: it.itemCode,
        itemName: it.itemName,
        quantity: it.quantity,
        uomName: it.uomName,
        warehouseCode: it.warehouseCode,
        issueMethod: it.issueMethod,
        lineNo: it.lineNo,
        selectedItemCode: it.selectedItemCode,
        selectedItemName: it.selectedItemName,
        selectedWarehouseCode: it.selectedWarehouseCode,
        selectedQuantity: it.selectedQuantity,
        isAlternative: it.isAlternative,
        sapIssueDocEntry: it.sapIssueDocEntry,
      })),
    }));
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

  /**
   * SAP B1 Service Layer üzerinden malzeme çıkışı (Goods Issue)
   * burayı senin mevcut SAP wrapper'ına göre implemente edeceğiz.
   */
  private async createSapGoodsIssue(payload: {
    itemCode: string;
    warehouseCode?: string | null;
    quantity: number;
    uomName?: string | null;
  }) {
    // Service Layer'da genelde:
    // POST /b1s/v1/InventoryGenExits
    // {
    //   "DocumentLines": [
    //     { "ItemCode": "...", "WarehouseCode": "...", "Quantity": 1 }
    //   ]
    // }

    const doc = {
      DocumentLines: [
        {
          ItemCode: payload.itemCode,
          WarehouseCode: payload.warehouseCode,
          Quantity: payload.quantity,
        },
      ],
    };

    // SapService içinde bir post metodu olduğunu varsayıyorum
    const res: any = await this.sap.post('/b1s/v1/InventoryGenExits', doc);

    // res.DocEntry gibi bir alan döner
    return res.DocEntry || null;
  }
}
