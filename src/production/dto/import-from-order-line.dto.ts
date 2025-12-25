import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportFromOrderLineDto {
  @Type(() => Number)
  @IsInt()
  docEntry: number;

  @Type(() => Number)
  @IsInt()
  lineNum: number;

  @IsString()
  itemCode: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @IsOptional()
  @IsString()
  whsCode?: string;
}
