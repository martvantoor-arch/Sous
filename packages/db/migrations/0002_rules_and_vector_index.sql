-- Vectorindex: drizzle-kit genereert geen ivfflat, dus met de hand.
CREATE INDEX IF NOT EXISTS source_chunks_embedding_idx
  ON source_chunks USING ivfflat (embedding vector_cosine_ops);
--> statement-breakpoint
-- Toezeggingen die te lang stil zijn markeren. Draait als cron, dagelijks 03:00.
-- Nooit stilzwijgend sluiten: stilte is een eigen status, geen afronding.
CREATE OR REPLACE FUNCTION mark_stale_commitments(days integer DEFAULT 21)
RETURNS integer LANGUAGE sql AS $$
  WITH upd AS (
    UPDATE commitments
       SET status = 'stil'
     WHERE status = 'open'
       AND last_seen_at < now() - (days || ' days')::interval
    RETURNING 1
  ) SELECT count(*)::int FROM upd;
$$;
