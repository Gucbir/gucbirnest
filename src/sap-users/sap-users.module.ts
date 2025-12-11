// src/sap-users/sap-users.module.ts
import { Module } from '@nestjs/common';
import { SapUsersService } from './sap-users.service';
import { SapUsersController } from './sap-users-controller';
import { SapUsersSyncService } from './sap-users-sync.service';
import { SapModule } from '../sap/sap.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [SapModule], // ⬅️ BURAYA SADECE MODULE'LER
  providers: [
    SapUsersService, // ⬅️ SERVICE'LER BURADA
    SapUsersSyncService,
    PrismaService,
  ],
  controllers: [SapUsersController],
  exports: [SapUsersSyncService], // ⬅️ CLI'de app.get ile çekebilmek için
})
export class SapUsersModule {}
