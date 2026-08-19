import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketStatusCode } from '../enums/ticket-status.enum';
import { IsEnum } from 'class-validator';

export class ChangeTicketStatusDto {
  @IsEnum(TicketStatusCode)
  toStatus: TicketStatusCode;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
