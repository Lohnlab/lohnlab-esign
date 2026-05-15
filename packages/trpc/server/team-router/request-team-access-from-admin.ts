import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendTeamAccessRequestEmail } from '@documenso/lib/server-only/team/send-team-access-request-email';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZRequestTeamAccessFromAdminRequestSchema,
  ZRequestTeamAccessFromAdminResponseSchema,
  requestTeamAccessFromAdminMeta,
} from './request-team-access-from-admin.types';

export const requestTeamAccessFromAdminRoute = authenticatedProcedure
  .meta(requestTeamAccessFromAdminMeta)
  .input(ZRequestTeamAccessFromAdminRequestSchema)
  .output(ZRequestTeamAccessFromAdminResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamUrl, pagePath } = input;
    const { id: userId, email: requestingUserEmail, name: requestingUserName } = ctx.user;

    const team = await prisma.team.findFirst({
      where: {
        url: teamUrl,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
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
      return;
    }

    await sendTeamAccessRequestEmail({
      requestingUserName: requestingUserName ?? null,
      requestingUserEmail: requestingUserEmail,
      teamName: team.name,
      teamUrl,
      pagePath,
    });
  });
