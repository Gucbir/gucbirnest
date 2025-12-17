import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Form } from '@prisma/client';

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  async setForms(
    name: string,
    values: any,
    orderNo: number,
  ): Promise<Form | null> {
    return this.prisma.form.upsert({
      where: { name },
      update: { values },
      create: { name, values, orderNo },
    });
  }

  async getForms(name: string) {
    const getform = await this.prisma.form.findUnique({
      where: { name },
    });
    return getform;
  }
}
