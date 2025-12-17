// src/cli/control.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ItemsSyncService } from '../items-sync/items-sync.service';
// import {ItemStoc}
import { WarehouseSyncService } from '../items-sync/warehouse-sync.service';
import { SapUsersSyncService } from '../sap-users/sap-users-sync.service';
import { OpenSalesOrderSyncService } from '../items-sync/open-sales-order-sync.service';
import { UsersSyncService } from '../items-sync/users-sync.service'; // ✅ EKLENDİ

const bootstrap = async () => {
  const [, , command, arg1] = process.argv; // node control.js <command>
  if (!command) {
    printHelp();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const runSapUsersSync = async (sapUsersSyncService) => {
    console.log(
      '🚀 [sapusers:sync] SAP → PostgreSQL Settings.settings (sapusers) senkronu başlatılıyor...',
    );
    const result = await sapUsersSyncService.syncSapUsers();
    console.log('✔️ [sapusers:sync] Tamamlandı:', result);
  };

  const runItemsSync = async (itemsSyncService: ItemsSyncService) => {
    console.log(
      '🚀 [items:sync] SAP → PostgreSQL item senkronu başlatılıyor...',
    );
    const result = await itemsSyncService.syncAllItems();
    console.log('✔️ [items:sync] Tamamlandı:', result);
  };

  const runWarehousesSync = async (svc: WarehouseSyncService) => {
    console.log(
      '🚀 [warehouses:sync] SAP → PostgreSQL warehouse senkronu başlatılıyor...',
    );
    const result = await svc.syncWarehouses();
    console.log('✔️ [warehouses:sync] Tamamlandı:', result);
  };

  // const runStockSyncAll = async (svc: OpenSalesOrderSyncService) => {
  //   console.log(
  //     `🚀 [stock:sync:all] Aktif depolar için stok senkronu başlıyor...`,
  //   );
  //   const result = await svc.syncAllActiveWarehouses();
  //   console.log(`✔️ [stock:sync:all] Tamamlandı:`, result);
  // };

  const runOpenSalesOrderSync = async (svc: OpenSalesOrderSyncService) => {
    console.log(
      `🚀 [orders:sync:open] Açık satış siparişleri senkronu başlıyor...`,
    );

    const result = await svc.syncOpenSalesOrders();

    console.log(`✔️ [orders:sync:open] Tamamlandı:`, result);
  };

  async function runUsersImport(UsersSyncService: UsersSyncService) {
    console.log('🚀 [users:import] Excel → PostgreSQL User import başlıyor...');
    await UsersSyncService.importFromExcel();
    console.log('✔️ [users:sync] Import tamamlandı.');
  }

  try {
    switch (command) {
      case 'items:sync':
      case 'items':
        await runItemsSync(app.get(ItemsSyncService));
        break;
      // case 'stock:sync:all':
      // case 'stocks:sync': {
      //   await runStockSyncAll(app.get(ItemStockSyncService));
      //   break;
      // }
      case 'warehouses:sync':
      case 'warehouses':
        await runWarehousesSync(app.get(WarehouseSyncService));
        break;
      case 'sapusers:sync':
      case 'sapusers':
      case 'sap-users':
        await runSapUsersSync(app.get(SapUsersSyncService));
        break;
      case 'orders:sync:open': {
        await runOpenSalesOrderSync(app.get(OpenSalesOrderSyncService));
        break;
      }
      // case 'warehouses:sync':
      //   await runWarehousesSync(app.get(WarehouseSyncService));
      //   break;
      case 'users:sync':
      case 'users':
        await runUsersImport(app.get(UsersSyncService));
        break;
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

const printHelp = () => {
  console.log(`
Kullanım:
  yarn control <komut>

Mevcut komutlar:
  items:sync       SAP -> PostgreSQL tüm ürünleri senkronize eder

Örnek:
  yarn control items:sync
`);
};

bootstrap();
