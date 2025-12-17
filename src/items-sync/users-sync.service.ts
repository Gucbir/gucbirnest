import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as xlsx from 'xlsx';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersSyncService {
  constructor(private prisma: PrismaService) {}

  normalizeFirstName(fullName: string) {
    const first = fullName.split(' ')[0].toLocaleLowerCase('tr');
    return first.charAt(0).toLocaleUpperCase('tr') + first.slice(1);
  }

  async importFromExcel() {
    const filePath = './test.xlsx'; // 🔥 Sabit dosya yolu
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (
        !row ||
        row.every(
          (cell: string | number | undefined) =>
            !cell || cell.toString().trim() === '',
        )
      ) {
        continue;
      }
      const fullName = row[0]?.toString().trim() || ''; // A
      const vkn = row[1]?.toString().trim(); // B
      const department = row[2]?.toString().trim(); // C
      const phone = row[3]?.toString().trim(); // D

      if (!fullName || !vkn || !department || !phone) {
        console.log(`⚠️ Satır ${i} eksik bilgi, atlandı.`);
        continue;
      }
      const firstName = this.normalizeFirstName(fullName);
      const passwordPlain = `${firstName}${vkn.slice(-4)}*`;
      const passwordHash = await bcrypt.hash(passwordPlain, 10);
      console.log(`📌 Toplam satır: ${rows.length}`);
      console.log(`✅ ${fullName} → şifre: ${passwordPlain}`);

      try {
        await this.prisma.user.create({
          data: {
            fullName,
            phone,
            vkn,
            department,
            passwordHash,
            role: 'User',
            isActive: true,
          },
        });
        console.log(`✅ ${fullName} → şifre: ${passwordPlain}`);
      } catch (err) {
        console.log(`❌ Satır ${i} eklenirken hata:`, err.message);
      }
    }
    console.log('✔️ Excel import başarıyla tamamlandı.');
  }
}
