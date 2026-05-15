import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

export type InsertOrganisationMembersIntoTeamInternalGroupsOptions = {
  teamId: number;
  membersToCreate: {
    organisationMemberId: string;
    teamRole: TeamMemberRole;
  }[];
  /**
   * When true, duplicate (organisationMemberId, groupId) rows are ignored.
   * Used for domain auto-join idempotent sync.
   */
  skipDuplicates?: boolean;
};

/**
 * Adds organisation members to this team's INTERNAL_TEAM role groups.
 * Does not perform caller permission checks — only call from trusted server paths.
 */
export const insertOrganisationMembersIntoTeamInternalGroups = async ({
  teamId,
  membersToCreate,
  skipDuplicates = false,
}: InsertOrganisationMembersIntoTeamInternalGroupsOptions): Promise<void> => {
  if (membersToCreate.length === 0) {
    return;
  }

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
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
      teamGroups: {
        where: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_TEAM,
          },
        },
        include: {
          organisationGroup: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
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

  const teamMemberGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.MEMBER,
  );

  const teamManagerGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.MANAGER,
  );

  const teamAdminGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.ADMIN,
  );

  if (!teamMemberGroup || !teamManagerGroup || !teamAdminGroup) {
    console.error({
      message: 'Team groups not found.',
      teamMemberGroup: Boolean(teamMemberGroup),
      teamManagerGroup: Boolean(teamManagerGroup),
      teamAdminGroup: Boolean(teamAdminGroup),
    });

    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team groups not found.',
    });
  }

  await prisma.organisationGroupMember.createMany({
    data: membersToCreate.map((member) => ({
      id: generateDatabaseId('group_member'),
      organisationMemberId: member.organisationMemberId,
      groupId: match(member.teamRole)
        .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
        .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
        .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
        .exhaustive(),
    })),
    skipDuplicates,
  });
};
