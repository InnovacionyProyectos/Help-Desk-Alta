import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;

  // Solo Admin/Técnico pueden marcar is_internal = true (se valida en el service según el rol)
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
