import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Audit } from '@common/decorators/audit.decorator';

// Todo el módulo es exclusivo de Administrador: gestión total de usuarios.
@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Audit('User')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // Se declara antes de ':id' para que 'technicians' no sea capturado como parámetro.
  // Override de @Roles a nivel de método: Técnico también puede consultar esta lista
  // para reasignar tickets dentro de su área, aunque el resto del módulo sea solo Admin.
  @Get('technicians')
  @Roles('ADMIN', 'TECHNICIAN')
  findTechnicians() {
    return this.usersService.findByRole('TECHNICIAN');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Audit('User')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Audit('User')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Patch(':id/unlock')
  @Audit('User')
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unlock(id);
  }
}
