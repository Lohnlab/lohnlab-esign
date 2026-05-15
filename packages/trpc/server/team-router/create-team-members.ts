import type { TeamMemberRole } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { insertOrganisationMembersIntoTeamInternalGroups } from '@documenso/lib/server-only/team/insert-organisation-members-into-team-internal-groups';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateTeamMembersRequestSchema,
  ZCreateTeamMembersResponseSchema,
} from './create-team-members.types';

export const createTeamMembersRoute = authenticatedProcedure
  .input(ZCreateTeamMembersRequestSchema)
  .output(ZCreateTeamMembersResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, organisationMembers } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
        organisationMembers,
      },
    });

    return await createTeamMembers({
      userId: user.id,
      teamId,
      membersToCreate: organisationMembers,
    });
  });

type CreateTeamMembersOptions = {
  userId: number;
  teamId: number;
  membersToCreate: {
    organisationMemberId: string;
    teamRole: TeamMemberRole;
  }[];
};

export const createTeamMembers = async ({
  userId,
  teamId,
  membersToCreate,
}: CreateTeamMembersOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    include: {
      organisation: {
        include: {
          members: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found or missing permissions',
    });
  }

  const isMembersPartOfOrganisation = membersToCreate.every((member) =>
    team.organisation.members.some(({ id }) => id === member.organisationMemberId),
  );

  if (!isMembersPartOfOrganisation) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Some member IDs do not exist',
    });
  }

  const { teamRole: currentUserTeamRole } = await getMemberRoles({
    teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  });

  if (
    !membersToCreate.every((member) =>
      isTeamRoleWithinUserHierarchy(currentUserTeamRole, member.teamRole),
    )
  ) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Cannot add a member with a role higher than your own',
    });
  }

  await insertOrganisationMembersIntoTeamInternalGroups({
    teamId,
    membersToCreate,
  });
};
