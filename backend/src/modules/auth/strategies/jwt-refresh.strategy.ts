import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

interface JwtRefreshPayload {
  sub: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  // La validación de que el token siga vigente/no revocado en BD (rotación)
  // ocurre en AuthService.refresh(), que compara contra refresh_tokens.token_hash.
  validate(req: Request, payload: JwtRefreshPayload) {
    return { userId: payload.sub, refreshToken: req.body.refreshToken };
  }
}
