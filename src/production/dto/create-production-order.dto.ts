import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateProductionOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  docEntry?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  docNum?: number;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serialNo?: string;
}
