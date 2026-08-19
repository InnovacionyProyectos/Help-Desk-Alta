import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { TicketPriority } from '@modules/tickets/enums/ticket-priority.enum';

export class CreateTypificationDto extends CreateCategoryDto {
  @IsInt()
  subcategoryId: number;

  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @IsOptional()
  @IsInt()
  @Min(0)
  slaHours?: number;
}
