import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const PARENT_ID = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

function setup() {
  const category = {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'c1' }),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const groupBy = () => ({ groupBy: jest.fn().mockResolvedValue([]) });
  const transaction = groupBy();
  const prisma = {
    category,
    transaction,
    recurrence: groupBy(),
    budget: groupBy(),
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const service = new CategoriesService(prisma as unknown as PrismaService);
  // Depois de gravar, o service relê a categoria; aqui não interessa o retorno
  jest.spyOn(service, 'get').mockResolvedValue({ id: 'c1' } as never);
  return { service, category, transaction };
}

const input = {
  name: 'Viagens',
  type: 'EXPENSE' as const,
  color: '#ff682c',
  icon: 'plane' as const,
};

describe('CategoriesService.create', () => {
  it('subcategoria herda a cor da principal e não guarda ícone', async () => {
    const { service, category } = setup();
    category.findFirst
      .mockResolvedValueOnce({
        id: PARENT_ID,
        type: 'EXPENSE',
        color: '#8B5CF6',
        parentId: null,
        archived: false,
      })
      .mockResolvedValueOnce(null);
    await service.create('u1', { ...input, parentId: PARENT_ID });
    expect(category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        parentId: PARENT_ID,
        color: '#8B5CF6',
        icon: null,
      }),
      select: { id: true },
    });
  });

  it('não permite terceiro nível (principal que já é subcategoria)', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValueOnce({
      id: PARENT_ID,
      type: 'EXPENSE',
      color: null,
      parentId: 'outra',
      archived: false,
    });
    await expect(service.create('u1', { ...input, parentId: PARENT_ID })).rejects.toThrow(
      'categoria principal',
    );
  });

  it('principal de outra pessoa é tratada como inexistente', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValueOnce(null);
    await expect(service.create('u1', { ...input, parentId: PARENT_ID })).rejects.toThrow(
      'não encontrada',
    );
    expect(category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PARENT_ID, userId: 'u1' } }),
    );
  });

  it('recusa nome repetido entre irmãs', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValueOnce({ id: 'existente' });
    await expect(service.create('u1', input)).rejects.toBeInstanceOf(ConflictException);
    expect(category.create).not.toHaveBeenCalled();
  });
});

describe('CategoriesService.remove', () => {
  it('não exclui categoria já usada em lançamentos', async () => {
    const { service, category, transaction } = setup();
    category.findFirst.mockResolvedValueOnce({ id: 'c1', parentId: null });
    transaction.groupBy.mockResolvedValueOnce([{ categoryId: 'c1', _count: { _all: 3 } }]);
    await expect(service.remove('u1', 'c1')).rejects.toThrow('Arquive');
    expect(category.delete).not.toHaveBeenCalled();
  });

  it('responde 404 para categoria de outra pessoa', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValueOnce(null);
    await expect(service.remove('u1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CategoriesService.update', () => {
  it('não muda o tipo da categoria', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValueOnce({ id: 'c1', type: 'INCOME', parentId: null });
    await expect(service.update('u1', 'c1', input)).rejects.toThrow('tipo');
  });
});
