import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Audit } from '@common/decorators/audit.decorator';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  // Lectura abierta a cualquier usuario autenticado: se usa en filtros de
  // reportes y en el formulario de usuarios/tickets.
  @Get()
  findAll() {
    return this.areasService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @Audit('Area')
  create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @Audit('Area')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }
}
