import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const role = await this.rolesRepo.findOne({ where: { code: dto.roleCode } });
    if (!role) throw new NotFoundException(`Rol ${dto.roleCode} no encontrado`);

    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash: await argon2.hash(dto.password),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role,
      area: dto.areaId ? ({ id: dto.areaId } as any) : undefined,
    });

    return this.usersRepo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find({ where: { deletedAt: IsNull() } });
  }

  findByRole(roleCode: string): Promise<User[]> {
    return this.usersRepo.find({
      where: { role: { code: roleCode as any }, isActive: true, deletedAt: IsNull() },
      order: { firstName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.roleCode) {
      const role = await this.rolesRepo.findOne({ where: { code: dto.roleCode } });
      if (!role) throw new NotFoundException(`Rol ${dto.roleCode} no encontrado`);
      user.role = role;
    }

    Object.assign(user, {
      firstName: dto.firstName ?? user.firstName,
      lastName: dto.lastName ?? user.lastName,
      phone: dto.phone ?? user.phone,
      isActive: dto.isActive ?? user.isActive,
      area: dto.areaId ? ({ id: dto.areaId } as any) : user.area,
    });

    return this.usersRepo.save(user);
  }

  // Soft delete: preserva el historial de tickets/comentarios/auditoría asociado al usuario.
  async softDelete(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.deletedAt = new Date();
    user.isActive = false;
    await this.usersRepo.save(user);
  }

  // Limpia un bloqueo por intentos fallidos (AuthService.login bloquea tras
  // 5 intentos por 15 min); el Admin puede liberar la cuenta antes de que
  // expire por sí sola.
  async unlock(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
    return this.usersRepo.save(user);
  }
}
