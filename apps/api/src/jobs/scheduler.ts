import cron from 'node-cron';
import { QUOTA } from '@inbox/shared';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from '../lib/logger.js';

export interface ScheduledJob {
  name: string;
  /** Expression cron à 5 champs, évaluée dans le fuseau d'Afrique/Douala. */
  schedule: string;
  run: (ctx: { prisma: PrismaClient; logger: Logger }) => Promise<void>;
}

const jobs: ScheduledJob[] = [];

export function registerJob(job: ScheduledJob): void {
  jobs.push(job);
}

export function listJobs(): readonly ScheduledJob[] {
  return jobs;
}

/**
 * Les tâches planifiées tournent dans le processus de l'API, dans le fuseau de
 * Douala : la bascule mensuelle du quota doit avoir lieu à minuit local, pas à
 * minuit UTC.
 */
export function startScheduler(ctx: { prisma: PrismaClient; logger: Logger }): () => void {
  const tasks = jobs.map((job) => {
    const task = cron.schedule(
      job.schedule,
      async () => {
        const startedAt = Date.now();
        try {
          await job.run(ctx);
          ctx.logger.info(
            { job: job.name, ms: Date.now() - startedAt },
            'tâche planifiée terminée',
          );
        } catch (err) {
          ctx.logger.error({ job: job.name, err }, 'tâche planifiée en échec');
        }
      },
      { timezone: QUOTA.timezone },
    );
    return task;
  });

  ctx.logger.info({ count: tasks.length }, 'tâches planifiées démarrées');

  return () => {
    for (const task of tasks) void task.stop();
  };
}
