import { IsInt } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class CreateSubcategoryDto extends CreateCategoryDto {
  @IsInt()
  categoryId: number;
}
