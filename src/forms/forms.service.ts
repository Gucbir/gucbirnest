import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Form } from '@prisma/client';

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  async setForms(name: string, values: any, orderNo: number): Promise<Form> {
    const existing = await this.prisma.form.findUnique({
      where: { name },
    });

    let mergedValues = values;

    if (existing?.values) {
      const oldValues =
        typeof existing.values === 'string'
          ? JSON.parse(existing.values)
          : existing.values;

      mergedValues = {
        ...oldValues,
        ...values,
      };
    }

    return this.prisma.form.upsert({
      where: { name },
      update: { values: mergedValues },
      create: { name, orderNo, values: mergedValues },
    });
  }

  async getOneForm(name: string) {
    if (!name) throw new Error('Name required');
    const form = await this.prisma.form.findUnique({
      where: { name },
    });
    if (!form) throw new Error('Form bulunamadı');
    const values =
      typeof form.values === 'string' ? JSON.parse(form.values) : form.values;
    return {
      ...form,
      values,
    };
  }

  async getForms() {
    //  TEST aşamasındaki tamamlanan unit'ler
    const units = await this.prisma.productionOperationUnit.findMany({
      where: {
        status: 'done',
        operation: {
          stageCode: 'TEST',
        },
      },
      include: {
        unit: {
          select: {
            serialNo: true,
            order: {
              select: {
                sapDocEntry: true,
              },
            },
          },
        },
      },
    });

    // serialNo listesi
    const serialNos = units.map((u) => u.unit.serialNo);

    //  Bu serialNo’lara ait formlar
    const forms = await this.prisma.form.findMany({
      where: {
        name: { in: serialNos },
      },
      select: {
        name: true,
        values: true, // Json
      },
    });

    const formMap: Record<string, { KKF: boolean; SKF: boolean }> = {};

    for (const f of forms) {
      const values = f.values as any;

      formMap[f.name] = {
        KKF: !!values?.KKF,
        SKF: !!values?.SKF,
      };
    }

    //  unit + form
    return units.map((u) => ({
      orderNo: u.unit.order.sapDocEntry,
      serialNo: u.unit.serialNo,
      forms: formMap[u.unit.serialNo] ?? {
        KKF: false,
        SKF: false,
      },
    }));
  }
}
