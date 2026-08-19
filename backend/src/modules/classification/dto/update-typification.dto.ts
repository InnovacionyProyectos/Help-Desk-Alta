import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTypificationDto } from './create-typification.dto';

export class UpdateTypificationDto extends PartialType(CreateTypificationDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
