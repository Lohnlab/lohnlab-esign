import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const checkTeamUrlAccessMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/team/access/check-url',
    summary: 'Check whether the current user can access a team URL',
    description:
      'Returns whether the team exists and whether the authenticated user is a member (has team access).',
    tags: ['Team'],
  },
};

export const ZCheckTeamUrlAccessRequestSchema = z.object({
  teamUrl: z.string().trim().min(1).max(30),
});

export const ZCheckTeamUrlAccessResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('NOT_FOUND'),
  }),
  z.object({
    kind: z.literal('HAS_ACCESS'),
    teamId: z.number(),
    teamName: z.string(),
  }),
  z.object({
    kind: z.literal('NO_MEMBERSHIP'),
    teamId: z.number(),
    teamName: z.string(),
    organisationName: z.string(),
  }),
]);

export type TCheckTeamUrlAccessResponse = z.infer<typeof ZCheckTeamUrlAccessResponseSchema>;
