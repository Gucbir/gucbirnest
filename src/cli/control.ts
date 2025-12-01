// src/cli/control.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ItemsSyncService } from '../items-sync/items-sync.service';

const bootstrap = async () => {
  const [, , command] = process.argv; // node control.js <command>
  if (!command) {
    printHelp();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  async function runItemsSync(itemsSyncService: ItemsSyncService) {
    console.log(
      '🚀 [items:sync] SAP → PostgreSQL item senkronu başlatılıyor...',
    );
    const result = await itemsSyncService.syncAllItems();
    console.log('✔️ [items:sync] Tamamlandı:', result);
  }

  try {
    switch (command) {
      case 'items:sync':
      case 'items':
        await runItemsSync(app.get(ItemsSyncService));
        break;

      // case 'warehouses:sync':
      //   await runWarehousesSync(app.get(WarehouseSyncService));
      //   break;

      default:
        console.error(`❌ Bilinmeyen komut: ${command}`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Komut çalışırken hata oluştu:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
    process.exit();
  }
};

function printHelp() {
  console.log(`
Kullanım:
  yarn control <komut>

Mevcut komutlar:
  items:sync       SAP -> PostgreSQL tüm ürünleri senkronize eder

Örnek:
  yarn control items:sync
`);
}

bootstrap();
