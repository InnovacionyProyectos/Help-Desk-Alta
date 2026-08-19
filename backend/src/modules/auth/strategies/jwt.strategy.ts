import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { AuthenticatedUser } from '../types/authenticated-user.type';

interface JwtAccessPayload {
  sub: string; // user id
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  /**
   * Se ejecuta en cada request autenticado. Re-consulta el usuario (en
   * lugar de confiar ciegamente en el payload) para reflejar de inmediato
   * bloqueos, desactivaciones o cambios de rol hechos por un Admin.
   */
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      relations: ['role', 'area'],
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      areaId: user.area?.id,
    };
  }
}
