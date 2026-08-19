import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '@modules/users/entities/area.entity';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(@InjectRepository(Area) private readonly areasRepo: Repository<Area>) {}

  findAll(): Promise<Area[]> {
    return this.areasRepo.find({ order: { name: 'ASC' } });
  }

  create(dto: CreateAreaDto): Promise<Area> {
    return this.areasRepo.save(this.areasRepo.create(dto));
  }

  async update(id: number, dto: UpdateAreaDto): Promise<Area> {
    const area = await this.areasRepo.findOne({ where: { id } });
    if (!area) throw new NotFoundException(`Área ${id} no encontrada`);
    Object.assign(area, dto);
    return this.areasRepo.save(area);
  }
}
