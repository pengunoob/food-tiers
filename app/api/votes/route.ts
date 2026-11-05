import { ID, Query } from "node-appwrite";
import {
  adminTables,
  databaseConfig,
  errorResponse,
  requireUser,
} from "../_lib/appwrite";
import { synchronizeRestaurantAggregate } from "../_lib/vote-totals";

type VoteInput = { restaurantId?: string; tier?: number };

function validTier(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

async function findUserVote(restaurantId: string, userId: string) {
  const config = databaseConfig();
  const result = await adminTables().listRows({
    databaseId: config.databaseId,
    tableId: config.votesTableId,
    queries: [Query.equal("restaurantId", restaurantId), Query.equal("userId", userId), Query.limit(1)],
    total: false,
    ttl: 0,
  });
  return result.rows[0];
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const config = databaseConfig();
    const result = await adminTables().listRows({
      databaseId: config.databaseId,
      tableId: config.votesTableId,
      queries: [Query.equal("userId", user.$id), Query.limit(100)],
      total: false,
      ttl: 0,
    });
    return Response.json({
      votes: result.rows.map((vote) => ({ restaurantId: vote.restaurantId, tier: Number(vote.tier) })),
    });
  } catch (error) {
    return errorResponse(error, 401);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as VoteInput;
    if (!body.restaurantId || !validTier(body.tier)) {
      return errorResponse(new Error("Choose a restaurant and a tier from S through F."));
    }

    const config = databaseConfig();
    const previous = await findUserVote(body.restaurantId, user.$id);

    if (previous) {
      await adminTables().updateRow({
        databaseId: config.databaseId,
        tableId: config.votesTableId,
        rowId: previous.$id,
        data: { tier: body.tier },
      });
      await synchronizeRestaurantAggregate(body.restaurantId);
    } else {
      await adminTables().createRow({
        databaseId: config.databaseId,
        tableId: config.votesTableId,
        rowId: ID.unique(),
        data: { restaurantId: body.restaurantId, userId: user.$id, tier: body.tier },
      });
      await synchronizeRestaurantAggregate(body.restaurantId);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const restaurantId = new URL(request.url).searchParams.get("restaurantId");
    if (!restaurantId) return errorResponse(new Error("A restaurant ID is required."));
    const previous = await findUserVote(restaurantId, user.$id);
    if (!previous) return errorResponse(new Error("No vote exists for this restaurant."), 404);

    const config = databaseConfig();
    await adminTables().deleteRow({
      databaseId: config.databaseId,
      tableId: config.votesTableId,
      rowId: previous.$id,
    });
    await synchronizeRestaurantAggregate(restaurantId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
