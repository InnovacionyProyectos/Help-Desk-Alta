import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketType } from '../enums/ticket-type.enum';

// Actualización de campos "de negocio". Cambios de estado y asignación
// tienen sus propios DTOs/endpoints porque requieren reglas y auditoría distintas.
export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;

  @IsOptional()
  @IsInt()
  typificationId?: number;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketType)
  ticketType?: TicketType;
}
