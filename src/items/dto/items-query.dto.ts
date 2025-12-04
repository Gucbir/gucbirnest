import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemsQueryDto {
  // Sayfalama
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  // Arama
  @IsString()
  @IsOptional()
  search;

  // Temel filtreler
  @IsString()
  @IsOptional()
  itemType; // 'I' | 'L' | 'A'

  @IsBooleanString()
  @IsOptional()
  inventoryItem; // 'true' | 'false'

  @IsBooleanString()
  @IsOptional()
  salesItem;

  @IsBooleanString()
  @IsOptional()
  purchaseItem;

  @IsBooleanString()
  @IsOptional()
  valid;

  @IsBooleanString()
  @IsOptional()
  frozen;

  @IsBooleanString()
  @IsOptional()
  assetItem;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  groupCode; // ItemsGroupCode

  // Stoklu ürün filtreleri
  @IsBooleanString()
  @IsOptional()
  hasStock; // QuantityOnStock > 0

  // Sıralama
  @IsString()
  @IsOptional()
  orderBy; // 'ItemCode' | 'ItemName' | 'QuantityOnStock' | 'AvgPrice'

  @IsString()
  @IsOptional()
  orderDir; // 'asc' | 'desc'
}
