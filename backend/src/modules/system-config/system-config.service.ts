import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

const SINGLETON_ID = 1;

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {}

  async get(): Promise<SystemConfig> {
    const config = await this.configRepo.findOne({ where: { id: SINGLETON_ID } });
    return config ?? this.configRepo.create({ id: SINGLETON_ID });
  }

  async update(dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    const config = await this.get();
    const { smtpPassword, ...rest } = dto;

    Object.assign(config, rest);
    if (smtpPassword) {
      // En producción: cifrar con KMS/Vault antes de persistir, nunca texto plano.
      config.smtpPasswordEncrypted = smtpPassword;
    }

    return this.configRepo.save(config);
  }
}
