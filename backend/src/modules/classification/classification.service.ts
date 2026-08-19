import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategory } from './entities/ticket-category.entity';
import { TicketSubcategory } from './entities/ticket-subcategory.entity';
import { TicketTypification } from './entities/ticket-typification.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { CreateTypificationDto } from './dto/create-typification.dto';
import { UpdateTypificationDto } from './dto/update-typification.dto';
import { CategoryOptionDto } from './dto/classification-cascade-response.dto';

@Injectable()
export class ClassificationService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,
    @InjectRepository(TicketSubcategory)
    private readonly subcategoryRepo: Repository<TicketSubcategory>,
    @InjectRepository(TicketTypification)
    private readonly typificationRepo: Repository<TicketTypification>,
  ) {}

  // ===================================================================
  // CASCADA (consumida por el formulario de creación de tickets)
  // ===================================================================

  /**
   * Devuelve el árbol completo Categoría -> Subcategoría -> Tipificación,
   * filtrando solo elementos activos, listo para poblar los 3 <select>
   * encadenados del frontend en una sola llamada.
   */
  async getCascade(): Promise<CategoryOptionDto[]> {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      relations: ['subcategories', 'subcategories.typifications'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      subcategories: (category.subcategories ?? [])
        .filter((sub) => sub.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          typifications: (sub.typifications ?? [])
            .filter((typ) => typ.isActive)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((typ) => ({
              id: typ.id,
              name: typ.name,
              defaultPriority: typ.defaultPriority,
            })),
        })),
    }));
  }

  /**
   * Árbol completo SIN filtrar por `isActive`, para la pantalla de
   * administración: el Admin necesita ver también los elementos
   * desactivados para poder reactivarlos.
   */
  async getAdminTree(): Promise<TicketCategory[]> {
    return this.categoryRepo.find({
      relations: ['subcategories', 'subcategories.typifications'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Segundo nivel: subcategorías activas de una categoría (carga bajo demanda). */
  async getSubcategoriesByCategory(categoryId: number): Promise<TicketSubcategory[]> {
    await this.findCategoryOrFail(categoryId);
    return this.subcategoryRepo.find({
      where: { category: { id: categoryId }, isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Tercer nivel: tipificaciones activas de una subcategoría (carga bajo demanda). */
  async getTypificationsBySubcategory(
    subcategoryId: number,
  ): Promise<TicketTypification[]> {
    await this.findSubcategoryOrFail(subcategoryId);
    return this.typificationRepo.find({
      where: { subcategory: { id: subcategoryId }, isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Valida que category -> subcategory -> typification formen una cadena
   * jerárquica válida y activa. Se usa al crear/editar un ticket para
   * evitar combinaciones inconsistentes (ej. tipificación de otra rama).
   */
  async validateChain(
    categoryId: number,
    subcategoryId: number,
    typificationId: number,
  ): Promise<TicketTypification> {
    const typification = await this.typificationRepo.findOne({
      where: { id: typificationId, isActive: true },
      relations: ['subcategory', 'subcategory.category'],
    });

    if (
      !typification ||
      typification.subcategory.id !== subcategoryId ||
      typification.subcategory.category.id !== categoryId ||
      !typification.subcategory.isActive ||
      !typification.subcategory.category.isActive
    ) {
      throw new ConflictException(
        'La combinación categoría / subcategoría / tipificación no es válida o está inactiva',
      );
    }

    return typification;
  }

  // ===================================================================
  // CRUD ADMINISTRATIVO — Categorías
  // ===================================================================

  createCategory(dto: CreateCategoryDto): Promise<TicketCategory> {
    return this.categoryRepo.save(this.categoryRepo.create(dto));
  }

  async updateCategory(id: number, dto: UpdateCategoryDto): Promise<TicketCategory> {
    const category = await this.findCategoryOrFail(id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  listCategories(): Promise<TicketCategory[]> {
    return this.categoryRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  private async findCategoryOrFail(id: number): Promise<TicketCategory> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return category;
  }

  // ===================================================================
  // CRUD ADMINISTRATIVO — Subcategorías
  // ===================================================================

  async createSubcategory(dto: CreateSubcategoryDto): Promise<TicketSubcategory> {
    const category = await this.findCategoryOrFail(dto.categoryId);
    const subcategory = this.subcategoryRepo.create({ ...dto, category });
    return this.subcategoryRepo.save(subcategory);
  }

  async updateSubcategory(
    id: number,
    dto: UpdateSubcategoryDto,
  ): Promise<TicketSubcategory> {
    const subcategory = await this.findSubcategoryOrFail(id);
    if (dto.categoryId) {
      subcategory.category = await this.findCategoryOrFail(dto.categoryId);
    }
    Object.assign(subcategory, dto);
    return this.subcategoryRepo.save(subcategory);
  }

  private async findSubcategoryOrFail(id: number): Promise<TicketSubcategory> {
    const subcategory = await this.subcategoryRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!subcategory) throw new NotFoundException(`Subcategoría ${id} no encontrada`);
    return subcategory;
  }

  // ===================================================================
  // CRUD ADMINISTRATIVO — Tipificaciones
  // ===================================================================

  async createTypification(dto: CreateTypificationDto): Promise<TicketTypification> {
    const subcategory = await this.findSubcategoryOrFail(dto.subcategoryId);
    const typification = this.typificationRepo.create({ ...dto, subcategory });
    return this.typificationRepo.save(typification);
  }

  async updateTypification(
    id: number,
    dto: UpdateTypificationDto,
  ): Promise<TicketTypification> {
    const typification = await this.findTypificationOrFail(id);
    if (dto.subcategoryId) {
      typification.subcategory = await this.findSubcategoryOrFail(dto.subcategoryId);
    }
    Object.assign(typification, dto);
    return this.typificationRepo.save(typification);
  }

  private async findTypificationOrFail(id: number): Promise<TicketTypification> {
    const typification = await this.typificationRepo.findOne({ where: { id } });
    if (!typification) throw new NotFoundException(`Tipificación ${id} no encontrada`);
    return typification;
  }
}
