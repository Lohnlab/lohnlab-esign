import { OrganisationType, Prisma } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  normalizeEmailDomainForAutoJoin,
  syncAllDomainAutoJoinMembersForTeam,
} from '@documenso/lib/server-only/team/sync-domain-auto-join-for-team';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateTeamSettingsRequestSchema,
  ZUpdateTeamSettingsResponseSchema,
} from './update-team-settings.types';

export const updateTeamSettingsRoute = authenticatedProcedure
  .input(ZUpdateTeamSettingsRequestSchema)
  .output(ZUpdateTeamSettingsResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { teamId, data } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      documentTimezone,
      documentDateFormat,
      includeSenderDetails,
      includeSigningCertificate,
      includeAuditLog,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      delegateDocumentOwnership,
      envelopeExpirationPeriod,

      // Branding related settings.
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,

      // Email related settings.
      emailId,
      emailReplyTo,
      // emailReplyToName,
      emailDocumentSettings,

      // Default recipients settings.
      defaultRecipients,
      // AI features settings.
      aiFeaturesEnabled,

      domainAutoJoinEnabled,
      domainAutoJoinDomain,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'No settings to update',
      });
    }

    // Signatures will only be inherited if all are NULL.
    if (
      typedSignatureEnabled === false &&
      uploadSignatureEnabled === false &&
      drawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      include: {
        organisation: {
          select: {
            type: true,
          },
        },
        teamGlobalSettings: {
          select: {
            domainAutoJoinEnabled: true,
            domainAutoJoinDomain: true,
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this team.',
      });
    }

    // Validate that the email ID belongs to the organisation.
    if (emailId) {
      const email = await prisma.organisationEmail.findFirst({
        where: {
          id: emailId,
          organisationId: team.organisationId,
        },
      });

      if (!email) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Email not found',
        });
      }
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId: team.organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      select: {
        type: true,
        organisationGlobalSettings: {
          select: {
            includeSenderDetails: true,
          },
        },
      },
    });

    const isPersonalOrganisation = organisation?.type === OrganisationType.PERSONAL;
    const currentIncludeSenderDetails =
      organisation?.organisationGlobalSettings.includeSenderDetails;

    const isChangingIncludeSenderDetails =
      includeSenderDetails !== undefined && includeSenderDetails !== currentIncludeSenderDetails;

    if (isPersonalOrganisation && isChangingIncludeSenderDetails) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Personal teams cannot update the sender details',
      });
    }

    const touchDomainSettings =
      domainAutoJoinEnabled !== undefined || domainAutoJoinDomain !== undefined;

    if (isPersonalOrganisation && touchDomainSettings) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Domain-based auto-join is not available for personal organisations',
      });
    }

    let nextDomainAutoJoinEnabled = team.teamGlobalSettings.domainAutoJoinEnabled ?? false;
    let nextDomainAutoJoinDomain = team.teamGlobalSettings.domainAutoJoinDomain;

    if (touchDomainSettings) {
      if (domainAutoJoinEnabled !== undefined && domainAutoJoinEnabled !== null) {
        nextDomainAutoJoinEnabled = domainAutoJoinEnabled;
      }

      if (domainAutoJoinEnabled === false) {
        nextDomainAutoJoinDomain = null;
      } else if (domainAutoJoinDomain !== undefined) {
        nextDomainAutoJoinDomain =
          domainAutoJoinDomain === null || domainAutoJoinDomain.trim() === ''
            ? null
            : normalizeEmailDomainForAutoJoin(domainAutoJoinDomain);
      }

      if (nextDomainAutoJoinEnabled && !nextDomainAutoJoinDomain) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Domain is required when domain auto-join is enabled',
        });
      }

      if (
        nextDomainAutoJoinDomain !== null &&
        nextDomainAutoJoinDomain !== undefined &&
        nextDomainAutoJoinDomain.length > 0 &&
        !nextDomainAutoJoinDomain.includes('.')
      ) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid email domain',
        });
      }
    }

    const settingsUpdate: Prisma.TeamGlobalSettingsUncheckedUpdateInput = {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      documentTimezone,
      documentDateFormat,
      includeSenderDetails,
      includeSigningCertificate,
      includeAuditLog,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      delegateDocumentOwnership,
      envelopeExpirationPeriod:
        envelopeExpirationPeriod === null ? Prisma.DbNull : envelopeExpirationPeriod,

      // Branding related settings.
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,

      // Email related settings.
      emailId,
      emailReplyTo,
      // emailReplyToName,
      emailDocumentSettings: emailDocumentSettings === null ? Prisma.DbNull : emailDocumentSettings,
      defaultRecipients: defaultRecipients === null ? Prisma.DbNull : defaultRecipients,

      // AI features settings.
      aiFeaturesEnabled,
    };

    if (touchDomainSettings) {
      settingsUpdate.domainAutoJoinEnabled = nextDomainAutoJoinEnabled;
      settingsUpdate.domainAutoJoinDomain = nextDomainAutoJoinDomain;
    }

    await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        teamGlobalSettings: {
          update: settingsUpdate,
        },
      },
    });

    if (touchDomainSettings && nextDomainAutoJoinEnabled && nextDomainAutoJoinDomain) {
      const syncResult = await syncAllDomainAutoJoinMembersForTeam({
        teamId,
        bypassOrganisationJoinEmail: true,
      });

      return {
        domainAutoJoinSync: syncResult,
      };
    }

    return {};
  });
