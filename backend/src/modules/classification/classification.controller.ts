import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { CreateTypificationDto } from './dto/create-typification.dto';
import { UpdateTypificationDto } from './dto/update-typification.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { Audit } from '@common/decorators/audit.decorator';

@Controller('classification')
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  // ===================================================================
  // Lectura — disponible para cualquier usuario autenticado
  // (Usuario Final la necesita para crear tickets)
  // ===================================================================

  /** GET /classification/cascade -> árbol completo Categoría->Subcategoría->Tipificación */
  @Get('cascade')
  getCascade() {
    return this.classificationService.getCascade();
  }

  /** GET /classification/admin-tree -> árbol completo incluyendo elementos inactivos (solo Admin) */
  @Get('admin-tree')
  @Roles('ADMIN')
  getAdminTree() {
    return this.classificationService.getAdminTree();
  }

  /** GET /classification/categories/:id/subcategories -> segundo nivel bajo demanda */
  @Get('categories/:id/subcategories')
  getSubcategories(@Param('id', ParseIntPipe) categoryId: number) {
    return this.classificationService.getSubcategoriesByCategory(categoryId);
  }

  /** GET /classification/subcategories/:id/typifications -> tercer nivel bajo demanda */
  @Get('subcategories/:id/typifications')
  getTypifications(@Param('id', ParseIntPipe) subcategoryId: number) {
    return this.classificationService.getTypificationsBySubcategory(subcategoryId);
  }

  // ===================================================================
  // CRUD — solo Administrador
  // ===================================================================

  @Get('categories')
  @Roles('ADMIN')
  listCategories() {
    return this.classificationService.listCategories();
  }

  @Post('categories')
  @Roles('ADMIN')
  @Audit('TicketCategory')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.classificationService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles('ADMIN')
  @Audit('TicketCategory')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.classificationService.updateCategory(id, dto);
  }

  @Post('subcategories')
  @Roles('ADMIN')
  @Audit('TicketSubcategory')
  createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.classificationService.createSubcategory(dto);
  }

  @Patch('subcategories/:id')
  @Roles('ADMIN')
  @Audit('TicketSubcategory')
  updateSubcategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.classificationService.updateSubcategory(id, dto);
  }

  @Post('typifications')
  @Roles('ADMIN')
  @Audit('TicketTypification')
  createTypification(@Body() dto: CreateTypificationDto) {
    return this.classificationService.createTypification(dto);
  }

  @Patch('typifications/:id')
  @Roles('ADMIN')
  @Audit('TicketTypification')
  updateTypification(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTypificationDto,
  ) {
    return this.classificationService.updateTypification(id, dto);
  }
}
