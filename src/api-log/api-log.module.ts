import { Module } from '@nestjs/common';
import { ApiLogService } from './api-log.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ApiLogService],
  exports: [ApiLogService],
})
export class ApiLogModule {}
