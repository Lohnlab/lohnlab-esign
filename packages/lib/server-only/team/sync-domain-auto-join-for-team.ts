import { OrganisationMemberRole, OrganisationType, TeamMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { insertOrganisationMembersIntoTeamInternalGroups } from '@documenso/lib/server-only/team/insert-organisation-members-into-team-internal-groups';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

export const normalizeEmailDomainForAutoJoin = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase();
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  return withoutAt;
};

export const extractEmailDomainFromAddress = (email: string): string | null => {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');

  if (at === -1 || at === lower.length - 1) {
    return null;
  }

  return lower.slice(at + 1);
};

export type EnsureUserInTeamViaDomainAutoJoinOptions = {
  userId: number;
  teamId: number;
  /**
   * When true, skips sending organisation-member-joined emails (used for bulk sync).
   */
  bypassOrganisationJoinEmail?: boolean;
};

/**
 * Ensures the user is an organisation MEMBER and has explicit INTERNAL_TEAM membership
 * for this team (MEMBER role), when the team has domain auto-join configured for their email domain.
 */
export const ensureUserInTeamViaDomainAutoJoin = async ({
  userId,
  teamId,
  bypassOrganisationJoinEmail = false,
}: EnsureUserInTeamViaDomainAutoJoinOptions): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      disabled: false,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return;
  }

  const emailDomain = extractEmailDomainFromAddress(user.email);

  if (!emailDomain) {
    return;
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      teamGlobalSettings: {
        domainAutoJoinEnabled: true,
        domainAutoJoinDomain: emailDomain,
      },
      organisation: {
        type: {
          not: OrganisationType.PERSONAL,
        },
      },
    },
    include: {
      organisation: {
        include: {
          groups: true,
        },
      },
    },
  });

  if (!team) {
    return;
  }

  const existingMember = await prisma.organisationMember.findFirst({
    where: {
      userId,
      organisationId: team.organisationId,
    },
  });

  if (!existingMember) {
    await addUserToOrganisation({
      userId,
      organisationId: team.organisationId,
      organisationGroups: team.organisation.groups,
      organisationMemberRole: OrganisationMemberRole.MEMBER,
      bypassEmail: bypassOrganisationJoinEmail,
    });
  }

  const hasTeamAccess = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
    }),
    select: {
      id: true,
    },
  });

  if (hasTeamAccess) {
    return;
  }

  const organisationMember = await prisma.organisationMember.findFirstOrThrow({
    where: {
      userId,
      organisationId: team.organisationId,
    },
    select: {
      id: true,
    },
  });

  await insertOrganisationMembersIntoTeamInternalGroups({
    teamId,
    membersToCreate: [
      {
        organisationMemberId: organisationMember.id,
        teamRole: TeamMemberRole.MEMBER,
      },
    ],
    skipDuplicates: true,
  });
};

export type SyncAllDomainAutoJoinMembersForTeamOptions = {
  teamId: number;
  bypassOrganisationJoinEmail?: boolean;
};

export type SyncAllDomainAutoJoinMembersForTeamResult = {
  usersMatched: number;
  usersProcessed: number;
};

/**
 * Adds all existing users whose email ends with the configured domain to the organisation
 * and team (as MEMBER). Intended when enabling domain auto-join or changing the domain.
 */
export const syncAllDomainAutoJoinMembersForTeam = async ({
  teamId,
  bypassOrganisationJoinEmail = true,
}: SyncAllDomainAutoJoinMembersForTeamOptions): Promise<SyncAllDomainAutoJoinMembersForTeamResult> => {
  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      teamGlobalSettings: true,
      organisation: {
        select: {
          type: true,
        },
      },
    },
  });

  if (!team?.teamGlobalSettings?.domainAutoJoinEnabled) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Domain auto-join is not enabled for this team',
    });
  }

  const domain = team.teamGlobalSettings.domainAutoJoinDomain;

  if (!domain) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Domain auto-join domain is not configured',
    });
  }

  if (team.organisation.type === OrganisationType.PERSONAL) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Domain auto-join is not available for personal organisations',
    });
  }

  const suffix = `@${domain}`;

  const users = await prisma.user.findMany({
    where: {
      email: {
        endsWith: suffix,
        mode: 'insensitive',
      },
      disabled: false,
    },
    select: {
      id: true,
    },
  });

  for (const row of users) {
    await ensureUserInTeamViaDomainAutoJoin({
      userId: row.id,
      teamId,
      bypassOrganisationJoinEmail,
    });
  }

  return {
    usersMatched: users.length,
    usersProcessed: users.length,
  };
};

export const tryDomainAutoJoinForNewUser = async ({
  userId,
}: {
  userId: number;
}): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      disabled: false,
    },
    select: {
      email: true,
    },
  });

  if (!user) {
    return;
  }

  const emailDomain = extractEmailDomainFromAddress(user.email);

  if (!emailDomain) {
    return;
  }

  const teams = await prisma.team.findMany({
    where: {
      teamGlobalSettings: {
        domainAutoJoinEnabled: true,
        domainAutoJoinDomain: emailDomain,
      },
      organisation: {
        type: {
          not: OrganisationType.PERSONAL,
        },
      },
    },
    select: {
      id: true,
    },
  });

  for (const { id } of teams) {
    await ensureUserInTeamViaDomainAutoJoin({
      userId,
      teamId: id,
      bypassOrganisationJoinEmail: true,
    });
  }
};
