import { getSupabase } from "./client";
import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PostgrestQueryBuilder, PostgrestFilterBuilder, PostgrestError } from "@supabase/postgrest-js";
import { Result } from "../utils/type-utils";

export interface InsertResult {
    success: boolean;
    count?: number;
    error?: string;
    details?: any;
}

export abstract class SupabaseWrapper<TRow = any> {
    protected client: SupabaseClient;
    protected abstract schema: z.ZodType<TRow>;
    protected abstract tableName: string;
    protected abstract primaryKey: string | string[];
    protected abstract schemaName: string;

    constructor(client: SupabaseClient = getSupabase()) {
        this.client = client;
    }

    validate(rows: TRow[]): { valid: TRow[]; errors: any[] } {
        const valid: TRow[] = [];
        const errors: any[] = [];

        for (const row of rows) {
            try {
                const validated = this.schema.parse(row) as TRow;
                valid.push(validated);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    errors.push({ row, errors: error.issues });
                } else {
                    errors.push({ row, error: String(error) });
                }
            }
        }

        return { valid, errors };
    }

    async batchUpsert(
        rows: TRow[],
        options: {
            ignoreDuplicates?: boolean;
            onConflict: string | string[];
            batchSize?: number;
        }
    ): Promise<InsertResult> {
        if (rows.length === 0) return { success: true, count: 0 };

        try {
            const batchSize = options.batchSize ?? 1000;
            const conflictColumns = options.onConflict ?? this.primaryKey;
            const onConflict = Array.isArray(conflictColumns)
                ? conflictColumns.join(",")
                : conflictColumns;

            let totalValidRows = 0;
            let totalValidationErrors = 0;
            const allErrors: any[] = [];

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(rows.length / batchSize);

                const { valid, errors } = this.validate(batch);
                totalValidationErrors += errors.length;

                if (errors.length > 0 && batchNum === 1) {
                    console.warn(`Validation errors in batch ${batchNum}: ${errors.length} rows failed`, errors.slice(0, 5));
                }

                if (valid.length === 0) {
                    console.warn(`Batch ${batchNum}/${totalBatches}: All rows failed validation, skipping`);
                    continue;
                }

                const { error } = await this.client
                    .schema(this.schemaName)
                    .from(this.tableName)
                    .upsert(valid as Record<string, unknown>[], { onConflict, ignoreDuplicates: options.ignoreDuplicates });

                if (error) {
                    allErrors.push(error);
                    console.error(`Batch ${batchNum}/${totalBatches}: Upsert failed - ${error.message}`);
                } else {
                    totalValidRows += valid.length;
                    if (batchNum % 100 === 0 || batchNum === totalBatches) {
                        console.log(`Batch ${batchNum}/${totalBatches}: Upserted ${valid.length} rows (Total: ${totalValidRows})`);
                    }
                }
            }

            if (allErrors.length > 0) {
                return {
                    success: false,
                    error: allErrors.map((e) => e?.message).join(" , \n"),
                    details: allErrors,
                };
            }

            if (totalValidRows === 0) {
                return { success: false, error: "No valid rows to upsert" };
            }

            return { success: true, count: totalValidRows };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                details: error,
            };
        }
    }

    protected async batchFetch<R = TRow>({
        query,
        batchSize = 1000,
    }: {
        query: (q: PostgrestQueryBuilder<any, any, any>) => PostgrestFilterBuilder<any, any, any, any>;
        batchSize?: number;
    }): Promise<Result<R[], PostgrestError>> {
      const allRows: R[] = [];
      let start = 0;
      let iteration = 0;
			let attempts = 1; 
			const maxAttempts = 4;
			const delayMs = 2000;
			const RETRYABLE_ERROR = /^(?:08\w{3}|53[34]00|40001|40P01|57014|57P0[123])$/;
      const maxIterations = 10000;

      while (iteration < maxIterations) {
        const base = this.client.schema(this.schemaName).from(this.tableName);
        const builtQuery = query(base);
				const { data, error } = await builtQuery.range(start, start + batchSize - 1);
				if (error) {
					if (error?.code && RETRYABLE_ERROR.test(error.code)) {
						if (attempts > maxAttempts) return { ok: false, error: error };
						console.error(`[DB] Error fetching from ${this.tableName}, retrying... attempt ${attempts}/${maxAttempts}`);
						await new Promise(resolve => setTimeout(resolve, delayMs * attempts));
						attempts += 1; 	
						continue; 
					} else {
						console.error(`[DB] Error not retryable:`, error)
						return { ok: false, error: error }; 
					}
        }
        if (!data || data.length === 0) break;

        allRows.push(...data);
        start += data.length;
				iteration++;
				attempts = 1;

        if (iteration % 100 === 0) {
            console.log(`[DB] Fetched ${allRows.length} rows from ${this.tableName} (iteration ${iteration})...`);
        }
      }

      if (iteration >= maxIterations) {
          console.warn(`[DB] Hit max iterations (${maxIterations}) for ${this.tableName}, may not have fetched all data`);
      }

      console.log(`[DB] Fetched ${allRows.length} total rows from ${this.tableName}`);
			return {ok: true, data: allRows};
  }
}
