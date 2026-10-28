import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CategoryDto, CategoryInputParsed } from '@financeiro/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildCategoryTree } from './category-tree';
import { DEFAULT_CATEGORIES } from './default-categories';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  type: true,
  color: true,
  icon: true,
  parentId: true,
  archived: true,
} as const;

/** Erro de validação preso a um campo do formulário. */
const fieldError = (field: string, message: string) =>
  new BadRequestException({ message, fields: { [field]: [message] } });

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTree(userId: string, includeArchived = false): Promise<CategoryDto[]> {
    const [rows, usage] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, ...(includeArchived ? {} : { archived: false }) },
        select: CATEGORY_SELECT,
      }),
      this.usageByCategory(userId),
    ]);
    return buildCategoryTree(rows.map((row) => ({ ...row, usageCount: usage.get(row.id) ?? 0 })));
  }

  /** Categoria com as subcategorias (inclusive arquivadas). */
  async get(userId: string, id: string): Promise<CategoryDto> {
    const rows = await this.prisma.category.findMany({
      where: { userId, OR: [{ id }, { parentId: id }] },
      select: CATEGORY_SELECT,
    });
    if (!rows.some((row) => row.id === id)) throw new NotFoundException('Categoria não encontrada');
    const usage = await this.usageByCategory(
      userId,
      rows.map((row) => row.id),
    );
    const tree = buildCategoryTree(
      rows.map((row) => ({ ...row, usageCount: usage.get(row.id) ?? 0 })),
    );
    // Uma subcategoria buscada sozinha vira raiz da árvore (o pai não está na consulta)
    return tree.find((node) => node.id === id)!;
  }

  async create(userId: string, input: CategoryInputParsed): Promise<CategoryDto> {
    const parent = input.parentId
      ? await this.findParent(userId, input.parentId, input.type)
      : null;
    await this.assertUniqueName(userId, input.name, input.type, parent?.id ?? null);

    const created = await this.prisma.category.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        parentId: parent?.id ?? null,
        // Subcategoria herda a cor da principal; o ícone vem da principal na exibição
        color: parent ? parent.color : (input.color ?? null),
        icon: parent ? null : (input.icon ?? null),
      },
      select: { id: true },
    });
    return this.get(userId, created.id);
  }

  async update(userId: string, id: string, input: CategoryInputParsed): Promise<CategoryDto> {
    const current = await this.findOwned(userId, id);
    if (input.type !== current.type) {
      throw fieldError('type', 'Não é possível mudar o tipo de uma categoria');
    }

    const parent = input.parentId
      ? await this.findParent(userId, input.parentId, input.type, id)
      : null;
    if (parent) {
      const children = await this.prisma.category.count({ where: { userId, parentId: id } });
      if (children > 0) {
        throw fieldError(
          'parentId',
          'Esta categoria tem subcategorias e não pode virar subcategoria de outra',
        );
      }
    }
    await this.assertUniqueName(userId, input.name, input.type, parent?.id ?? null, id);

    const color = parent ? parent.color : (input.color ?? null);
    await this.prisma.$transaction([
      this.prisma.category.update({
        where: { id },
        data: {
          name: input.name,
          parentId: parent?.id ?? null,
          color,
          icon: parent ? null : (input.icon ?? null),
        },
      }),
      // A cor da principal vale para as subcategorias, para gráficos e listas baterem
      ...(parent
        ? []
        : [this.prisma.category.updateMany({ where: { userId, parentId: id }, data: { color } })]),
    ]);
    return this.get(userId, id);
  }

  /** Arquivar some dos seletores, mas o histórico continua. Vale também para as subcategorias. */
  async setArchived(userId: string, id: string, archived: boolean): Promise<CategoryDto> {
    const current = await this.findOwned(userId, id);
    if (!archived) {
      if (current.parentId) {
        const parent = await this.prisma.category.findFirst({
          where: { id: current.parentId, userId },
          select: { name: true, archived: true },
        });
        if (parent?.archived) {
          throw new ConflictException(`Reative a categoria ${parent.name} antes`);
        }
      }
      await this.assertUniqueName(userId, current.name, current.type, current.parentId, id);
    }

    await this.prisma.$transaction([
      this.prisma.category.update({ where: { id }, data: { archived } }),
      ...(current.parentId
        ? []
        : [
            this.prisma.category.updateMany({
              where: { userId, parentId: id },
              data: { archived },
            }),
          ]),
    ]);
    return this.get(userId, id);
  }

  /** Exclui só categorias sem uso (nem nas subcategorias); as demais devem ser arquivadas. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    const children = await this.prisma.category.findMany({
      where: { userId, parentId: id },
      select: { id: true },
    });
    const usage = await this.usageByCategory(userId, [id, ...children.map((child) => child.id)]);
    if ([...usage.values()].some((count) => count > 0)) {
      throw new ConflictException(
        'Esta categoria (ou uma subcategoria) já foi usada. Arquive-a para escondê-la sem perder o histórico.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.category.deleteMany({ where: { userId, parentId: id } }),
      this.prisma.category.delete({ where: { id } }),
    ]);
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

  private async findOwned(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      select: CATEGORY_SELECT,
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  /** Só dois níveis: a principal precisa ser raiz, do mesmo tipo e estar ativa. */
  private async findParent(userId: string, parentId: string, type: string, selfId?: string) {
    if (parentId === selfId) {
      throw fieldError('parentId', 'Uma categoria não pode ser subcategoria dela mesma');
    }
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, userId },
      select: { id: true, type: true, color: true, parentId: true, archived: true },
    });
    if (!parent) throw fieldError('parentId', 'Categoria principal não encontrada');
    if (parent.parentId) {
      throw fieldError('parentId', 'Escolha uma categoria principal, não uma subcategoria');
    }
    if (parent.type !== type) {
      throw fieldError('parentId', 'A categoria principal é de outro tipo');
    }
    if (parent.archived) throw fieldError('parentId', 'A categoria principal está arquivada');
    return parent;
  }

  /** Nomes não se repetem entre irmãs ativas (o SQL Server compara sem diferenciar maiúsculas). */
  private async assertUniqueName(
    userId: string,
    name: string,
    type: string,
    parentId: string | null,
    exceptId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.category.findFirst({
      where: {
        userId,
        type,
        parentId,
        name,
        archived: false,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        message: 'Já existe uma categoria com este nome',
        fields: { name: ['Já existe uma categoria com este nome aqui'] },
      });
    }
  }

  private async usageByCategory(userId: string, ids?: string[]): Promise<Map<string, number>> {
    const categoryId = ids ? { in: ids } : { not: null };
    const [transactions, recurrences, budgets] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, categoryId },
        _count: { _all: true },
      }),
      this.prisma.recurrence.groupBy({
        by: ['categoryId'],
        where: { userId, categoryId },
        _count: { _all: true },
      }),
      this.prisma.budget.groupBy({
        by: ['categoryId'],
        where: { userId, ...(ids ? { categoryId: { in: ids } } : {}) },
        _count: { _all: true },
      }),
    ]);
    const usage = new Map<string, number>();
    for (const group of [...transactions, ...recurrences, ...budgets]) {
      if (!group.categoryId) continue;
      usage.set(group.categoryId, (usage.get(group.categoryId) ?? 0) + group._count._all);
    }
    return usage;
  }
}
