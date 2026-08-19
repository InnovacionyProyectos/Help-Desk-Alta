import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
