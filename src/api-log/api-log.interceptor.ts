import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { ApiLogService } from './api-log.service';
import { Reflector } from '@nestjs/core';
import { SKIP_LOG_KEY } from './decorators/skip-log.decorator';

@Injectable()
export class ApiLogInterceptor implements NestInterceptor {
  constructor(
    private readonly apiLogService: ApiLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const skipLog = this.reflector.getAllAndOverride<boolean>(SKIP_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipLog) {
      return next.handle(); // ⛔ loglama yapma(login/register için)
    }
    const resolveErrorMessage = (err: any) => {
      if (err.code === 'ETIMEDOUT')
        return 'SAP servisine bağlanılamadı (timeout)';
      if (err.code === 'ECONNREFUSED')
        return 'SAP servisi kapalı veya erişilemiyor';
      if (err.code === 'ENOTFOUND') return 'SAP adresi bulunamadı (DNS hatası)';
      if (err.response)
        return `SAP hata döndü: ${err.response.status} ${err.response.statusText}`;
      return err?.message || JSON.stringify(err) || 'Bilinmeyen hata';
    };

    return next.handle().pipe(
      // Başarılı log
      tap(async (response) => {
        if (!req.user) return;
        await this.apiLogService.createLog({
          path: req.originalUrl,
          status: 'SUCCESS',
          message: {
            method: req.method,
            ip: req.ip,
            user: req.user.id,
            response,
          },
          userId: req.user.id,
        });
      }),

      // Hata log
      catchError(async (err) => {
        if (!req.user) return;
        await this.apiLogService.createLog({
          path: req.originalUrl,
          status: 'ERROR',
          message: {
            method: req.method,
            ip: req.ip,
            user: req.user.id,
            error: resolveErrorMessage(err),
            details: {
              name: err.name,
              code: err.code,
              statusCode: err.status ?? 500,
            },
          },
          userId: req.user.id,
        });
        throw err;
      }),
    );
  }
}
