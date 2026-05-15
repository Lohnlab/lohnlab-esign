import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const requestTeamAccessFromAdminMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/access/request-from-admin',
    summary: 'Request team access via admin email',
    description:
      'Sends an email to the configured LohnLab admin so the user can be added to the team.',
    tags: ['Team'],
  },
};

export const ZRequestTeamAccessFromAdminRequestSchema = z.object({
  teamUrl: z.string().trim().min(1).max(30),
  pagePath: z.string().trim().min(1).max(2048),
});

export const ZRequestTeamAccessFromAdminResponseSchema = z.void();
