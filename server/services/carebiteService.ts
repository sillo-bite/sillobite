import { db as getDb } from '../db';
import { CanteenEntity, MenuItem } from '../models/mongodb-models';

const db = getDb();

interface MenuResponse {
  success: boolean;
  error?: string;
  data?: {
    user: {
      id: number;
      email: string;
      name: string;
      locationType: string | null;
      locationId: string | null;
    };
    canteens: Array<{
      id: string;
      name: string;
      description?: string;
      imageUrl?: string;
      logoUrl?: string;
      location?: string;
      contactNumber?: string;
      isActive: boolean;
    }>;
    menuItems: Array<{
      id: string;
      name: string;
      price: number;
      imageUrl?: string;
      description?: string;
      isVegetarian: boolean;
      stock: number;
      available: boolean;
      canteenId: string;
      canteenName?: string;
      categoryName?: string;
      cookingTime?: number;
      calories?: number;
    }>;
  };
}

export const carebiteService = {
  async getMenuForUser(em: string, tk: string): Promise<MenuResponse> {
    const usr = await db.user.findUnique({ where: { email: em } });
    if (!usr) {
      return { success: false, error: 'User not found' };
    }

    const tkRes = await db.$queryRaw<Array<{ user_id: number; token: string }>>`
      SELECT user_id, token FROM api_tokens WHERE user_id = ${usr.id} LIMIT 1
    `;

    if (tkRes.length === 0 || tkRes[0].token !== tk) {
      return { success: false, error: 'Invalid access token' };
    }

    const lt = usr.selectedLocationType;
    const li = usr.selectedLocationId;

    if (!lt || !li) {
      return { success: false, error: 'User has not selected a location' };
    }

    let query: any = { isActive: true };

    if (lt === 'college') {
      query.collegeIds = li;
    } else if (lt === 'organization') {
      query.organizationIds = li;
    } else if (lt === 'restaurant') {
      query.restaurantId = li;
    }

    const cans = await CanteenEntity.find(query)
      .select('id name description imageUrl logoUrl location contactNumber isActive')
      .lean()
      .exec();

    if (cans.length === 0) {
      return {
        success: true,
        data: {
          user: {
            id: usr.id,
            email: usr.email,
            name: usr.name,
            locationType: lt,
            locationId: li
          },
          canteens: [],
          menuItems: []
        }
      };
    }

    const canIds = cans.map(c => c.id);

    const items = await MenuItem.find({
      canteenId: { $in: canIds },
      available: true,
      stock: { $gt: 0 }
    })
      .select('name price imageUrl description isVegetarian stock available canteenId categoryId cookingTime calories')
      .populate('categoryId', 'name')
      .lean()
      .exec();

    const canMap = new Map(cans.map(c => [c.id, c.name]));

    const formattedItems = items.map((item: any) => ({
      id: item._id.toString(),
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      description: item.description,
      isVegetarian: item.isVegetarian,
      stock: item.stock,
      available: item.available,
      canteenId: item.canteenId,
      canteenName: canMap.get(item.canteenId),
      categoryName: item.categoryId?.name,
      cookingTime: item.cookingTime || 0,
      calories: item.calories || 0
    }));

    return {
      success: true,
      data: {
        user: {
          id: usr.id,
          email: usr.email,
          name: usr.name,
          locationType: lt,
          locationId: li
        },
        canteens: cans.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          logoUrl: c.logoUrl,
          location: c.location,
          contactNumber: c.contactNumber,
          isActive: c.isActive
        })),
        menuItems: formattedItems
      }
    };
  }
};
