import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignTicketDto {
  @IsUUID()
  technicianId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
