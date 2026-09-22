-- Le déclencheur d'immuabilité du journal d'audit refusait **tout** UPDATE.
-- Or PostgreSQL applique `ON DELETE SET NULL` par un UPDATE de la ligne
-- enfant : supprimer un compte ayant modéré échouait donc, et un ancien
-- modérateur devenait indéfiniment insupprimable. C'est incompatible avec le
-- droit à l'effacement, et c'était invisible tant que personne n'avait à la
-- fois modéré et demandé la suppression de son compte.
--
-- On tolère désormais une seule modification : le détachement de l'auteur.
-- Le reste de la ligne — action, cible, motif, date — doit être rigoureusement
-- identique, sans quoi la modification est refusée.

CREATE OR REPLACE FUNCTION inbox_audit_log_no_update()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."actorId" IS NOT NULL
     AND NEW."actorId" IS NULL
     AND (to_jsonb(NEW) - 'actorId') = (to_jsonb(OLD) - 'actorId')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'AuditLog est en écriture seule : UPDATE interdit'
    USING ERRCODE = 'restrict_violation';
END;
$$;
