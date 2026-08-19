import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TicketPriority } from '../enums/ticket-priority.enum';

export class CreateTicketDto {
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  description: string;

  @IsInt()
  categoryId: number;

  @IsInt()
  subcategoryId: number;

  @IsInt()
  typificationId: number;

  // Si no se envía, se toma el default_priority de la tipificación seleccionada
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  // Solo relevante cuando el módulo ITAM esté activo; opcional por diseño
  @IsOptional()
  @IsUUID()
  assetId?: string;
}
