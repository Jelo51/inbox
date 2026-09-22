-- Avertissement d'inactivité déjà envoyé, remis à NULL à la connexion suivante.
-- Sans cette colonne, la tâche « comptes-inactifs » réexpédierait le même
-- avertissement tous les jours pendant un an.
ALTER TABLE "User" ADD COLUMN "inactivityWarnedAt" TIMESTAMP(3);
