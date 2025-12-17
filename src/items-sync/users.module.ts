import { Module } from '@nestjs/common';
import { UsersSyncService } from './users-sync.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [UsersSyncService, PrismaService],
  exports: [UsersSyncService],
})
export class UserModule {}
