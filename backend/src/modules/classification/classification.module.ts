import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassificationService } from './classification.service';
import { ClassificationController } from './classification.controller';
import { TicketCategory } from './entities/ticket-category.entity';
import { TicketSubcategory } from './entities/ticket-subcategory.entity';
import { TicketTypification } from './entities/ticket-typification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketCategory, TicketSubcategory, TicketTypification]),
  ],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService], // usado por TicketsService para validar la cadena
})
export class ClassificationModule {}
