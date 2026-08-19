import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsString()
  companyLogoUrl?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttachmentSizeMb?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedExtensions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ticketPrefix?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string; // se recibe en claro solo en este DTO; el servicio lo cifra antes de persistir

  @IsOptional()
  @IsBoolean()
  smtpUseTls?: boolean;
}
