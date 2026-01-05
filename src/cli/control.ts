// src/cli/control.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

import { ItemsSyncService } from '../items-sync/items-sync.service';
import { WarehouseSyncService } from '../items-sync/warehouse-sync.service';
import { SapUsersSyncService } from '../sap-users/sap-users-sync.service';
import { UsersSyncService } from '../items-sync/users-sync.service';
import { OpenSalesOrderSyncService } from '../items-sync/items-stocks-sync.service';

// ✅ stok senkron servisin (bulk OITW)
import { ItemWarehouseStockSyncService } from '../items-sync/item-warehouse-stock-sync.service';

const bootstrap = async () => {
  const [, , command] = process.argv;
  if (!command) {
    printHelp();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const runSapUsersSync = async (svc: SapUsersSyncService) => {
    console.log(
      '🚀 [sapusers:sync] SAP → PostgreSQL Settings.settings (sapusers) senkronu başlatılıyor...',
    );
    const result = await svc.syncSapUsers();
    console.log('✔️ [sapusers:sync] Tamamlandı:', result);
  };

  const runItemsSync = async (svc: ItemsSyncService) => {
    console.log(
      '🚀 [items:sync] SAP → PostgreSQL item senkronu başlatılıyor...',
    );
    const result = await svc.syncAllItems();
    console.log('✔️ [items:sync] Tamamlandı:', result);
  };

  const runItemGroupsSync = async (svc: ItemsSyncService) => {
    console.log(
      '🚀 [item-groups:sync] SAP → PostgreSQL item group senkronu başlatılıyor...',
    );
    const result = await svc.syncAllItemGroups();
    console.log('✔️ [item-groups:sync] Tamamlandı:', result);
  };

  const runWarehousesSync = async (svc: WarehouseSyncService) => {
    console.log(
      '🚀 [warehouses:sync] SAP → PostgreSQL warehouse senkronu başlatılıyor...',
    );
    const result = await svc.syncWarehouses();
    console.log('✔️ [warehouses:sync] Tamamlandı:', result);
  };

  // ✅ stok:sync:all / stocks:sync
  const runStocksSyncAll = async (svc: ItemWarehouseStockSyncService) => {
    console.log('🚀 [stocks:sync] OITW bulk stok senkronu başlıyor...');

    // Sende method adı syncAllActiveWarehouses ise onu çağır,
    // yoksa benim önerdiğim syncStocks() ile devam et.
    const result =
      typeof (svc as any).syncAllActiveWarehouses === 'function'
        ? await (svc as any).syncAllActiveWarehouses()
        : await (svc as any).syncStocks();

    console.log('✔️ [stocks:sync] Tamamlandı:', result);
  };

  const runOpenSalesOrderSync = async (svc: OpenSalesOrderSyncService) => {
    console.log(
      '🚀 [orders:sync:open] Açık satış siparişleri senkronu başlıyor...',
    );
    const result = await svc.syncOpenSalesOrders();
    console.log('✔️ [orders:sync:open] Tamamlandı:', result);
  };

  const runUsersImport = async (svc: UsersSyncService) => {
    console.log('🚀 [users:import] Excel → PostgreSQL User import başlıyor...');
    await svc.importFromExcel();
    console.log('✔️ [users:import] Import tamamlandı.');
  };

  try {
    switch (command) {
      case 'item-groups:sync':
      case 'itemgroups:sync':
      case 'groups':
        await runItemGroupsSync(app.get(ItemsSyncService));
        break;

      case 'items:sync':
      case 'items':
        await runItemsSync(app.get(ItemsSyncService));
        break;

      case 'warehouses:sync':
      case 'warehouses':
        await runWarehousesSync(app.get(WarehouseSyncService));
        break;

      case 'stocks:sync':
      case 'stock:sync:all':
        await runStocksSyncAll(app.get(ItemWarehouseStockSyncService));
        break;

      case 'orders:sync:open':
        await runOpenSalesOrderSync(app.get(OpenSalesOrderSyncService));
        break;

      case 'sapusers:sync':
      case 'sapusers':
      case 'sap-users':
        await runSapUsersSync(app.get(SapUsersSyncService));
        break;

      case 'users:sync':
      case 'users':
      case 'users:import':
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
  items:sync            SAP -> PostgreSQL ürünleri senkronize eder
  item-groups:sync      SAP -> PostgreSQL ürün gruplarını senkronize eder
  warehouses:sync       SAP -> PostgreSQL depoları senkronize eder
  stocks:sync           SAP -> PostgreSQL OITW stokları senkronize eder (bulk)
  orders:sync:open      SAP -> PostgreSQL açık satış siparişlerini senkronize eder
  users:import          Excel -> PostgreSQL user import eder

Örnek:
  yarn control items:sync
  yarn control warehouses:sync
  yarn control stocks:sync
`);
};

bootstrap();
