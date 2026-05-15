import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCheckTeamUrlAccessRequestSchema,
  ZCheckTeamUrlAccessResponseSchema,
  checkTeamUrlAccessMeta,
} from './check-team-url-access.types';

export const checkTeamUrlAccessRoute = authenticatedProcedure
  .meta(checkTeamUrlAccessMeta)
  .input(ZCheckTeamUrlAccessRequestSchema)
  .output(ZCheckTeamUrlAccessResponseSchema)
  .query(async ({ ctx, input }) => {
    const { teamUrl } = input;
    const { id: userId } = ctx.user;

    const team = await prisma.team.findFirst({
      where: {
        url: teamUrl,
      },
      select: {
        id: true,
        name: true,
        organisation: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!team) {
      return {
        kind: 'NOT_FOUND' as const,
      };
    }

    const hasAccess = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId: team.id,
        userId,
      }),
      select: {
        id: true,
      },
    });

    if (hasAccess) {
      return {
        kind: 'HAS_ACCESS' as const,
        teamId: team.id,
        teamName: team.name,
      };
    }

    return {
      kind: 'NO_MEMBERSHIP' as const,
      teamId: team.id,
      teamName: team.name,
      organisationName: team.organisation.name,
    };
  });
