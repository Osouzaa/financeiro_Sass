import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  categoryInputSchema,
  type CategoryDto,
  type CategoryInputParsed,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { CategoriesService } from './categories.service';

@ApiTags('Categorias')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as categorias em árvore, com quantas vezes cada uma foi usada' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  list(
    @CurrentUser() user: AuthUser,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ): Promise<CategoryDto[]> {
    return this.categories.listTree(user.id, includeArchived ?? false);
  }

  @Post()
  @ApiOperation({ summary: 'Cria categoria ou subcategoria (com parentId)' })
  @ApiBody({ schema: openApiSchema(categoryInputSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(categoryInputSchema)) body: CategoryInputParsed,
  ): Promise<CategoryDto> {
    return this.categories.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza nome, cor, ícone ou categoria principal' })
  @ApiBody({ schema: openApiSchema(categoryInputSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(categoryInputSchema)) body: CategoryInputParsed,
  ): Promise<CategoryDto> {
    return this.categories.update(user.id, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Arquiva a categoria e as subcategorias' })
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryDto> {
    return this.categories.setArchived(user.id, id, true);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reativa uma categoria arquivada' })
  unarchive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryDto> {
    return this.categories.setArchived(user.id, id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui uma categoria nunca usada (e as subcategorias)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(user.id, id);
  }
}
