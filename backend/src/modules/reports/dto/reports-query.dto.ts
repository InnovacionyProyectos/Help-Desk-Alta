import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { TicketStatusCode } from '@modules/tickets/enums/ticket-status.enum';

export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(TicketStatusCode)
  status?: TicketStatusCode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  areaId?: number;
}
