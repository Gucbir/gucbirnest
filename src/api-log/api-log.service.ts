import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiLogService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(params: {
    path: string;
    message: any;
    userId: number;
    status: 'SUCCESS' | 'ERROR';
  }) {
    return this.prisma.log.create({
      data: {
        path: params.path,
        message: JSON.stringify(params.message),
        userId: params.userId,
        status: params.status,
      },
    });
  }
}
