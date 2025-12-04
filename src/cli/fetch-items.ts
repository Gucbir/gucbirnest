import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ItemsSyncService } from '../items-sync/items-sync.service';
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const service = app.get(ItemsSyncService);

  console.log('🚀 Running Items sync...');
  const result = await service.syncAllItems();
  console.log('✔️ Done:', result);

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('❌ Error executing fetch-items:', err);
  process.exit(1);
});
