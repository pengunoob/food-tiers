import { ID, Query } from "node-appwrite";
import {
  adminTables,
  databaseConfig,
  errorResponse,
  isAdmin,
  requireUser,
} from "../_lib/appwrite";
import { reconcileRestaurantAggregates } from "../_lib/vote-totals";

type RestaurantInput = {
  name?: string;
  city?: string;
  neighborhood?: string;
  cuisine?: string;
  categories?: string;
  averagePrice?: number | string;
  restaurantId?: string;
};

function cleanText(value: unknown, limit = 100) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanCategories(value: unknown) {
  return [...new Set(cleanText(value, 400).split(",").map((category) => category.trim()).filter(Boolean))]
    .slice(0, 8)
    .join(", ");
}

function cleanAveragePrice(value: unknown) {
  const price = Number(value);
  return Number.isInteger(price) && price >= 1 && price <= 5 ? price : null;
}

async function requireAdministrator(request: Request) {
  const user = await requireUser(request);
  if (!isAdmin(user.$id)) throw new Error("Administrator access is required.");
  return user;
}

export async function GET() {
  try {
    const config = databaseConfig();
    const result = await adminTables().listRows({
      databaseId: config.databaseId,
      tableId: config.restaurantsTableId,
      queries: [Query.equal("active", true), Query.orderAsc("name"), Query.limit(100)],
      total: false,
      ttl: 0,
    });

    const restaurants = await reconcileRestaurantAggregates(result.rows);
    return Response.json({
      restaurants: restaurants.map((restaurant) => ({
        id: restaurant.$id,
        name: restaurant.name,
        city: restaurant.city,
        neighborhood: restaurant.neighborhood,
        cuisine: restaurant.cuisine,
        categories: String(restaurant.categories ?? "").split(",").map((category) => category.trim()).filter(Boolean),
        averagePrice: cleanAveragePrice(restaurant.averagePrice),
        voteCount: Number(restaurant.voteCount ?? 0),
        scoreTotal: Number(restaurant.scoreTotal ?? 0),
      })),
    });
  } catch (error) {
    return errorResponse(error, 503);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdministrator(request);
    const body = (await request.json()) as RestaurantInput;
    const name = cleanText(body.name, 120);
    if (!name) return errorResponse(new Error("A restaurant name is required."));

    const config = databaseConfig();
    const averagePrice = cleanAveragePrice(body.averagePrice);
    const restaurant = await adminTables().createRow({
      databaseId: config.databaseId,
      tableId: config.restaurantsTableId,
      rowId: ID.unique(),
      data: {
        name,
        city: cleanText(body.city),
        neighborhood: cleanText(body.neighborhood),
        cuisine: cleanText(body.cuisine),
        categories: cleanCategories(body.categories),
        averagePrice,
        active: true,
        voteCount: 0,
        scoreTotal: 0,
      },
    });
    return Response.json({ id: restaurant.$id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 403);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdministrator(request);
    const body = (await request.json()) as RestaurantInput;
    if (!body.restaurantId) return errorResponse(new Error("A restaurant ID is required."));

    const data = {
      name: cleanText(body.name, 120),
      city: cleanText(body.city),
      neighborhood: cleanText(body.neighborhood),
      cuisine: cleanText(body.cuisine),
      categories: cleanCategories(body.categories),
      averagePrice: cleanAveragePrice(body.averagePrice),
    };
    const config = databaseConfig();
    await adminTables().updateRow({
      databaseId: config.databaseId,
      tableId: config.restaurantsTableId,
      rowId: body.restaurantId,
      data,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 403);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdministrator(request);
    const restaurantId = new URL(request.url).searchParams.get("restaurantId");
    if (!restaurantId) return errorResponse(new Error("A restaurant ID is required."));
    const config = databaseConfig();
    await adminTables().updateRow({
      databaseId: config.databaseId,
      tableId: config.restaurantsTableId,
      rowId: restaurantId,
      data: { active: false },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 403);
  }
}
