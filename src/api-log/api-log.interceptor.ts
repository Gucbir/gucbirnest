import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { ApiLogService } from './api-log.service';

@Injectable()
export class ApiLogInterceptor implements NestInterceptor {
  constructor(private readonly apiLogService: ApiLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

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
        await this.apiLogService.createLog({
          path: req.originalUrl,
          status: 'SUCCESS',
          message: {
            method: req.method,
            ip: req.ip,
            user: req.user!.id,
            response,
          },
          userId: req.user!.id,
        });
      }),

      // Hata log
      catchError(async (err) => {
        await this.apiLogService.createLog({
          path: req.originalUrl,
          status: 'ERROR',
          message: {
            method: req.method,
            ip: req.ip,
            user: req.user!.id,
            error: resolveErrorMessage(err),
            details: {
              name: err.name,
              code: err.code,
              statusCode: err.status ?? 500,
            },
          },
          userId: req.user!.id,
        });
        throw err;
      }),
    );
  }
}
