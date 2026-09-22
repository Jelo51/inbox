-- Recherche plein texte française, insensible aux accents, et immuabilité du
-- journal d'audit. Ces deux mécanismes ne sont pas exprimables dans le schéma
-- Prisma : ils vivent ici, en SQL.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Recherche plein texte
-- ─────────────────────────────────────────────────────────────────────────────

-- `unaccent()` appelée sans dictionnaire explicite est STABLE, pas IMMUTABLE :
-- PostgreSQL refuse alors de s'en servir dans une colonne générée. En nommant
-- le dictionnaire, la fonction devient déterministe et peut être déclarée
-- IMMUTABLE — c'est le contournement habituel, et le piège classique.
CREATE OR REPLACE FUNCTION inbox_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  STRICT
  PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Prisma a créé la colonne comme une colonne ordinaire ; on la remplace par une
-- colonne générée, pour qu'elle ne puisse jamais se désynchroniser du contenu.
ALTER TABLE "Listing" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "Listing"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', inbox_unaccent(coalesce("title", ''))), 'A')
    ||
    setweight(to_tsvector('french', inbox_unaccent(coalesce("description", ''))), 'B')
  ) STORED;

CREATE INDEX "Listing_searchVector_idx" ON "Listing" USING GIN ("searchVector");

-- Recherche par préfixe sur le titre (autocomplétion), accents ignorés.
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" (lower(inbox_unaccent("title")) text_pattern_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Journal d'audit immuable
-- ─────────────────────────────────────────────────────────────────────────────

-- Un journal de modération qui peut être réécrit ne prouve rien. La base refuse
-- donc toute mise à jour, y compris depuis l'application.
--
-- La suppression, elle, reste possible passé la durée de conservation : une
-- purge légale doit pouvoir s'exécuter. La fenêtre est portée par la base et
-- non par le code applicatif, pour qu'un bogue côté serveur ne puisse pas
-- effacer un journal récent.
CREATE OR REPLACE FUNCTION inbox_audit_log_no_update()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog est en écriture seule : UPDATE interdit'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION inbox_audit_log_retention_only()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  -- Durée de conservation : 5 ans (RETENTION_DAYS.auditLog dans packages/shared).
  IF OLD."createdAt" > now() - interval '5 years' THEN
    RAISE EXCEPTION 'AuditLog : suppression interdite avant la fin de la durée de conservation'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "AuditLog_no_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION inbox_audit_log_no_update();

CREATE TRIGGER "AuditLog_retention_only"
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION inbox_audit_log_retention_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Numérotation continue des reçus
-- ─────────────────────────────────────────────────────────────────────────────

-- Une pièce comptable ne peut pas avoir de trou dans sa numérotation. Une
-- séquence PostgreSQL en laisserait à chaque transaction annulée ; on calcule
-- donc le numéro sous verrou, par année.
CREATE OR REPLACE FUNCTION inbox_next_receipt_sequence(target_year integer)
  RETURNS integer
  LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('inbox_receipt_' || target_year));
  SELECT COALESCE(MAX("sequence"), 0) + 1 INTO next_sequence
    FROM "Receipt" WHERE "year" = target_year;
  RETURN next_sequence;
END;
$$;
