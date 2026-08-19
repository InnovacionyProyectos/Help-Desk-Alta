import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User } from '@modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<TokenPair & { user: AuthenticatedUser }> {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email },
      relations: ['role', 'area'],
    });

    // Mensaje genérico en ambos casos (usuario inexistente / password incorrecta)
    // para no filtrar qué correos existen en el sistema.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente. Intente nuevamente después de ${user.lockedUntil.toLocaleTimeString()}`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Cuenta desactivada. Contacte al administrador');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null; // `null`, no `undefined`: ver comentario en User.lockedUntil
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      areaId: user.area?.id,
    };

    const tokens = await this.issueTokenPair(user.id, meta);
    return { ...tokens, user: authenticatedUser };
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000);
      user.failedLoginAttempts = 0;
    }
    await this.usersRepo.save(user);
  }

  /**
   * Rotación de refresh tokens: el token presentado se revoca y se emite
   * uno nuevo enlazado (`replaced_by`), de forma que reutilizar un token
   * robado/ya usado invalida toda la cadena (family) de sesión.
   */
  async refresh(userId: string, presentedToken: string, meta: RequestMeta): Promise<TokenPair> {
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user', 'user.role', 'user.area'],
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.id !== userId) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    return this.issueTokenPair(userId, meta, stored.id);
  }

  async logout(userId: string, presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.refreshTokenRepo.update(
      { tokenHash, user: { id: userId } },
      { revokedAt: new Date() },
    );
  }

  /** Revoca todas las sesiones activas del usuario (ej. al cambiar contraseña o ser desactivado). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { user: { id: userId }, revokedAt: undefined },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(
    userId: string,
    meta: RequestMeta,
    replaces?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseDaysFromExpiresIn());

    const entity = this.refreshTokenRepo.create({
      user: { id: userId } as User,
      tokenHash: this.hashToken(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    const saved = await this.refreshTokenRepo.save(entity);

    if (replaces) {
      await this.refreshTokenRepo.update(replaces, { replacedBy: saved.id });
    }

    return { accessToken, refreshToken };
  }

  private parseDaysFromExpiresIn(): number {
    const raw = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const match = /^(\d+)d$/.exec(raw);
    return match ? parseInt(match[1], 10) : 7;
  }

  // El refresh token se guarda como hash SHA-256 (no reversible) en BD,
  // igual que la contraseña se guarda con argon2: nunca en texto plano.
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
