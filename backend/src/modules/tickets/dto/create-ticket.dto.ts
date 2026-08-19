import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TicketPriority } from '../enums/ticket-priority.enum';

export class CreateTicketDto {
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  description: string;

  // Opcionales: el Usuario Final solo diligencia asunto/descripción; la
  // clasificación la asigna después un Técnico o el Administrador. Si se
  // envía alguno de los tres, TicketsService exige que vengan los tres
  // (no se aceptan combinaciones parciales).
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;

  @IsOptional()
  @IsInt()
  typificationId?: number;

  // Si no se envía, se toma el default_priority de la tipificación (si hay)
  // o MEDIUM si el ticket aún no está clasificado.
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  // Solo relevante cuando el módulo ITAM esté activo; opcional por diseño
  @IsOptional()
  @IsUUID()
  assetId?: string;
}
