import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import * as multer from 'multer';
import { extname } from 'path';
import { SystemConfigService } from '@modules/system-config/system-config.service';
import { RequestWithFile } from '../types/request-with-file.type';

/**
 * Reemplaza al FileInterceptor estándar de Nest: los límites de tamaño y
 * las extensiones permitidas viven en `system_config` (editables por el
 * Admin en caliente), así que no pueden fijarse de forma estática en un
 * decorador. Este guard consulta la configuración vigente ANTES de aceptar
 * el archivo, parsea el multipart con multer (memoryStorage) y deja el
 * resultado en `request.file` para que el controlador lo use.
 */
@Injectable()
export class AttachmentUploadGuard implements CanActivate {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithFile>();
    const response = context.switchToHttp().getResponse();

    const config = await this.systemConfigService.get();
    const maxSizeBytes = config.maxAttachmentSizeMb * 1024 * 1024;

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxSizeBytes },
    }).single('file');

    await new Promise<void>((resolve, reject) => {
      upload(request, response, (err: unknown) => (err ? reject(err) : resolve()));
    }).catch((err: { code?: string }) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        throw new PayloadTooLargeException(
          `El archivo excede el tamaño máximo permitido (${config.maxAttachmentSizeMb}MB)`,
        );
      }
      throw new BadRequestException('No se pudo procesar el archivo adjunto');
    });

    if (!request.file) {
      throw new BadRequestException('Debe adjuntar un archivo (campo "file")');
    }

    const extension = extname(request.file.originalname).replace('.', '').toLowerCase();
    if (!config.allowedExtensions.map((e) => e.toLowerCase()).includes(extension)) {
      throw new BadRequestException(
        `Extensión ".${extension}" no permitida. Extensiones válidas: ${config.allowedExtensions.join(', ')}`,
      );
    }

    return true;
  }
}
