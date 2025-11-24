// src/orders/dto/first-route-issue.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FirstRouteIssueRequestDto {
  @IsInt()
  @Min(1)
  DocEntry: number;

  @IsOptional()
  @IsString()
  UserName?: string;
}

export class GoodsIssueResultDto {
  message: string;
  docEntry?: number;
}
