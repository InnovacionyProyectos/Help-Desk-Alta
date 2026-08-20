import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatusCode } from '../enums/ticket-status.enum';
import { TicketType } from '../enums/ticket-type.enum';

export class FindTicketsQueryDto {
  @IsOptional()
  @IsEnum(TicketStatusCode)
  status?: TicketStatusCode;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketType)
  ticketType?: TicketType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
