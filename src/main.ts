// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { ApiLogService } from './api-log/api-log.service';
import { ApiLogInterceptor } from './api-log/api-log.interceptor';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiLogService = app.get(ApiLogService);
  app.useGlobalInterceptors(new ApiLogInterceptor(apiLogService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: 'http://localhost:55000', // Next.js frontend adresin
    credentials: true, // cookie/token için gerekli
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  const port = process.env.PORT || 5001;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
}

bootstrap();
