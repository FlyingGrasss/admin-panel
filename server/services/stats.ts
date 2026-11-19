import type { AdminStats } from "../../shared/types.js";
import type { AppDatabase } from "../db.js";
import { listCollections } from "../repos/collections.js";
import { entryCountsByCollection } from "../repos/entries.js";
import { countApiEventsSince } from "../repos/events.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class StatsService {
  constructor(private readonly db: AppDatabase) {}

  getStats(now: number = Date.now()): AdminStats {
    const counts = new Map(
      entryCountsByCollection(this.db).map((row) => [row.collectionId, row]),
    );

    const collections = listCollections(this.db).map((collection) => {
      const count = counts.get(collection.id);
      return {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        total: count?.total ?? 0,
        draft: count?.draft ?? 0,
        published: count?.published ?? 0,
      };
    });

    return {
      collections,
      totalCollections: collections.length,
      totalEntries: collections.reduce((sum, collection) => sum + collection.total, 0),
      requestsLast24h: countApiEventsSince(this.db, now - DAY_MS),
    };
  }
}
