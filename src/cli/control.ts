// src/cli/control.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ItemsSyncService } from '../items-sync/items-sync.service';
import { ItemStockSyncService } from '../items-sync/item-stock-sync.service';
import { WarehouseSyncService } from '../items-sync/warehouse-sync.service';
import { SapUsersSyncService } from '../sap-users/sap-users-sync.service';

const bootstrap = async () => {
  const [, , command, arg1] = process.argv; // node control.js <command>
  if (!command) {
    printHelp();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  async function runSapUsersSync(sapUsersSyncService) {
    console.log(
      '🚀 [sapusers:sync] SAP → PostgreSQL Settings.settings (sapusers) senkronu başlatılıyor...',
    );
    const result = await sapUsersSyncService.syncSapUsers();
    console.log('✔️ [sapusers:sync] Tamamlandı:', result);
  }

  async function runItemsSync(itemsSyncService: ItemsSyncService) {
    console.log(
      '🚀 [items:sync] SAP → PostgreSQL item senkronu başlatılıyor...',
    );
    const result = await itemsSyncService.syncAllItems();
    console.log('✔️ [items:sync] Tamamlandı:', result);
  }

  async function runWarehousesSync(svc: WarehouseSyncService) {
    console.log(
      '🚀 [warehouses:sync] SAP → PostgreSQL warehouse senkronu başlatılıyor...',
    );
    const result = await svc.syncWarehouses();
    console.log('✔️ [warehouses:sync] Tamamlandı:', result);
  }

  async function runStockSync(
    stockService: ItemStockSyncService,
    whsCode?: string,
  ) {
    if (!whsCode) {
      console.error(
        '❌ [stock:sync] WhsCode parametresi eksik. Örn: yarn control stock:sync R1',
      );
      return;
    }

    console.log(
      `🚀 [stock:sync] SAP → PostgreSQL stok senkronu başlatılıyor. Depo=${whsCode}`,
    );
    const result = await stockService.syncWarehouseStocks(whsCode);
    console.log('✔️ [stock:sync] Tamamlandı:', result);
  }

  try {
    switch (command) {
      case 'items:sync':
      case 'items':
        await runItemsSync(app.get(ItemsSyncService));
        break;
      case 'stock:sync':
      case 'stocks:sync':
        await runStockSync(app.get(ItemStockSyncService), arg1);
        break;
      case 'warehouses:sync':
      case 'warehouses':
        await runWarehousesSync(app.get(WarehouseSyncService));
        break;
      case 'sapusers:sync':
      case 'sapusers':
      case 'sap-users':
        await runSapUsersSync(app.get(SapUsersSyncService));
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
