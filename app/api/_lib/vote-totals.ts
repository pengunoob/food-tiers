import { Models, Query } from "node-appwrite";
import { adminTables, databaseConfig } from "./appwrite";

type RestaurantRow = Models.Row & { voteCount?: number; scoreTotal?: number };
type VoteRow = Models.Row & { restaurantId?: string; tier?: number };

const PAGE_SIZE = 5_000;

async function listVotes(queries: string[] = []) {
  const config = databaseConfig();
  const result = await adminTables().listRows<VoteRow>({
    databaseId: config.databaseId,
    tableId: config.votesTableId,
    queries: [...queries, Query.limit(PAGE_SIZE)],
    total: false,
    ttl: 0,
  });
  return result.rows;
}

function totalsFor(votes: VoteRow[]) {
  return votes.reduce((totals, vote) => ({
    voteCount: totals.voteCount + 1,
    scoreTotal: totals.scoreTotal + Number(vote.tier ?? 0),
  }), { voteCount: 0, scoreTotal: 0 });
}

export async function synchronizeRestaurantAggregate(restaurantId: string) {
  const config = databaseConfig();
  const totals = totalsFor(await listVotes([Query.equal("restaurantId", restaurantId)]));
  await adminTables().updateRow({
    databaseId: config.databaseId,
    tableId: config.restaurantsTableId,
    rowId: restaurantId,
    data: totals,
  });
  return totals;
}

export async function reconcileRestaurantAggregates<T extends RestaurantRow>(restaurants: T[]) {
  const votesByRestaurant = new Map<string, VoteRow[]>();
  for (const vote of await listVotes()) {
    if (!vote.restaurantId) continue;
    const votes = votesByRestaurant.get(vote.restaurantId) ?? [];
    votes.push(vote);
    votesByRestaurant.set(vote.restaurantId, votes);
  }

  const config = databaseConfig();
  const tables = adminTables();
  return Promise.all(restaurants.map(async (restaurant) => {
    const totals = totalsFor(votesByRestaurant.get(restaurant.$id) ?? []);
    if (Number(restaurant.voteCount ?? 0) !== totals.voteCount || Number(restaurant.scoreTotal ?? 0) !== totals.scoreTotal) {
      await tables.updateRow({
        databaseId: config.databaseId,
        tableId: config.restaurantsTableId,
        rowId: restaurant.$id,
        data: totals,
      });
    }
    return { ...restaurant, ...totals };
  }));
}
