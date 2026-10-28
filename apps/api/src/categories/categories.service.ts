import { Injectable } from '@nestjs/common';
import type { CategoryDto } from '@financeiro/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildCategoryTree } from './category-tree';
import { DEFAULT_CATEGORIES } from './default-categories';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTree(userId: string): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, type: true, color: true, icon: true, parentId: true },
    });
    return buildCategoryTree(rows);
  }

  /** Cria as categorias padrão. Roda dentro da transação do cadastro. */
  async createDefaults(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    for (const category of DEFAULT_CATEGORIES) {
      const parent = await tx.category.create({
        data: {
          userId,
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon,
        },
        select: { id: true },
      });

      if (category.children?.length) {
        await tx.category.createMany({
          data: category.children.map((name) => ({
            userId,
            name,
            type: category.type,
            color: category.color,
            parentId: parent.id,
          })),
        });
      }
    }
  }
}
