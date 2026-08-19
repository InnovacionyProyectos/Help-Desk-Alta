import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TicketStatusCode } from '../enums/ticket-status.enum';

export class ChangeTicketStatusDto {
  @IsEnum(TicketStatusCode)
  toStatus: TicketStatusCode;

  // Obligatorio: todo cambio de estado (incluida la reapertura por el
  // Usuario Final) debe quedar justificado en el historial.
  @IsString()
  @IsNotEmpty({ message: 'El motivo del cambio de estado es obligatorio' })
  @MaxLength(255)
  reason: string;
}
