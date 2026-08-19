import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ChangeTicketStatusDto } from './dto/change-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FindTicketsQueryDto } from './dto/find-tickets-query.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Audit } from '@common/decorators/audit.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Cualquier usuario autenticado puede crear tickets (Usuario Final es el caso principal).
  @Post()
  @Audit('Ticket')
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.create(dto, user);
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: string, @Query() query: FindTicketsQueryDto) {
    return this.ticketsService.findMine(userId, query);
  }

  @Get('assigned-to-me')
  @Roles('TECHNICIAN', 'ADMIN')
  findAssignedToMe(@CurrentUser('id') userId: string, @Query() query: FindTicketsQueryDto) {
    return this.ticketsService.findAssignedTo(userId, query);
  }

  @Get()
  @Roles('ADMIN', 'TECHNICIAN')
  findAll(@Query() query: FindTicketsQueryDto) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findOneOrFail(id, user);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.getHistory(id, user);
  }

  // Solo Admin/Técnico pueden reclasificar o editar el contenido de un
  // ticket ya creado; el Usuario Final no tiene esta capacidad (ver spec).
  @Patch(':id')
  @Roles('ADMIN', 'TECHNICIAN')
  @Audit('Ticket')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  @Patch(':id/assign')
  @Roles('ADMIN', 'TECHNICIAN')
  @Audit('Ticket')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.assign(id, dto, user);
  }

  // Sin @Roles: alcanzable por cualquier usuario autenticado porque el
  // Usuario Final debe poder reabrir SU PROPIO ticket. TicketsService
  // valida propiedad y restringe qué transición puede pedir cada rol.
  @Patch(':id/status')
  @Audit('Ticket')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.changeStatus(id, dto, user);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.addComment(id, dto, user);
  }

  @Get(':id/comments')
  findComments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findComments(id, user);
  }
}
