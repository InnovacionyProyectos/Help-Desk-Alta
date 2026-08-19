import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Audit } from '@common/decorators/audit.decorator';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  // Lectura pública para cualquier usuario autenticado (ej. tamaño máx. de adjuntos, logo)
  @Get()
  get() {
    return this.systemConfigService.get();
  }

  @Patch()
  @Roles('ADMIN')
  @Audit('SystemConfig')
  update(@Body() dto: UpdateSystemConfigDto) {
    return this.systemConfigService.update(dto);
  }
}
