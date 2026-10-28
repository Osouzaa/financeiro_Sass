import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CategoryDto } from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('Categorias')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as categorias do usuário em árvore' })
  list(@CurrentUser() user: AuthUser): Promise<CategoryDto[]> {
    return this.categories.listTree(user.id);
  }
}
