import { categoriesRepository } from '../repositories/categories.repository.js';
import {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';
import { Category } from '../types/finance.types.js';
import { NotFoundError } from '../utils/errors.js';

export const categoriesService = {
  async list(userId: string, filters: ListCategoriesQuery): Promise<Category[]> {
    return categoriesRepository.listByUser(userId, filters);
  },

  async getById(userId: string, categoryId: string): Promise<Category> {
    const category = await categoriesRepository.findById(userId, categoryId);
    if (!category) {
      throw new NotFoundError('Categoria não encontrada.');
    }
    return category;
  },

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    return categoriesRepository.create(userId, input);
  },

  async update(
    userId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const updated = await categoriesRepository.update(userId, categoryId, input);
    if (!updated) {
      throw new NotFoundError('Categoria não encontrada.');
    }
    return updated;
  },

  async deactivate(userId: string, categoryId: string): Promise<Category> {
    const deactivated = await categoriesRepository.deactivate(userId, categoryId);
    if (!deactivated) {
      throw new NotFoundError('Categoria não encontrada.');
    }
    return deactivated;
  },
};
