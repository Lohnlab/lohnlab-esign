import { useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { ReadStatus } from '@prisma/client';
import { Building2Icon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import LogoImage from '@documenso/assets/logo.png';
import { authClient } from '@documenso/auth/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { cn } from '@documenso/ui/lib/utils';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavMobileProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
};

export const AppNavMobile = ({ isMenuOpen, onMenuOpenChange }: AppNavMobileProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();

  const { organisations } = useSession();

  const currentTeam = useOptionalCurrentTeam();
  const currentOrganisation = useOptionalCurrentOrganisation();

  const [showTeams, setShowTeams] = useState(false);
  const [showOrgs, setShowOrgs] = useState(false);

  const { data: unreadCountData } = trpc.document.inbox.getCount.useQuery(
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

  const handleMenuItemClick = () => {
    onMenuOpenChange?.(false);
  };

  const teams = useMemo(() => {
    const org = currentOrganisation || organisations[0];
    return org?.teams || [];
  }, [currentOrganisation, organisations]);

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [
        {
          href: '/inbox',
          text: t`Inbox`,
        },
        {
          href: '/settings/profile',
          text: t`Settings`,
        },
      ];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        text: t`Documents`,
      },
      {
        href: `/t/${teamUrl}/templates`,
        text: t`Templates`,
      },
      {
        href: '/inbox',
        text: t`Inbox`,
      },
      {
        href: '/settings/profile',
        text: t`Settings`,
      },
    ];
  }, [currentTeam, organisations]);

  const handleSelectTeam = (teamUrl: string) => {
    handleMenuItemClick();
    void navigate(`/t/${teamUrl}/documents`);
  };

  return (
    <Sheet open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      <SheetContent className="flex w-full max-w-[350px] flex-col">
        <Link to={currentTeam ? formatDocumentsPath(currentTeam.url) : '/'} onClick={handleMenuItemClick}>
          <img
            src={LogoImage}
            alt="LohnLab eSign"
            className="dark:invert"
            width={170}
            height={25}
          />
        </Link>

        {!isPersonalLayout(organisations) && teams.length > 0 && (
          <div className="mt-6">
            <button
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground"
              onClick={() => setShowTeams(!showTeams)}
            >
              <span className="flex items-center gap-2">
                {currentTeam && (
                  <Avatar className="h-5 w-5">
                    {currentTeam.avatarImageId && (
                      <AvatarImage src={formatAvatarUrl(currentTeam.avatarImageId)} />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {currentTeam.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {currentTeam?.name ?? t`Team`}
              </span>
              {showTeams ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
            {showTeams && (
              <div className="mt-2 space-y-1 rounded-md border p-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                      team.id === currentTeam?.id && 'bg-accent font-medium',
                    )}
                    onClick={() => handleSelectTeam(team.url)}
                  >
                    <Avatar className="h-5 w-5">
                      {team.avatarImageId && (
                        <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {team.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{team.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex w-full flex-col items-start gap-y-4">
          {menuNavigationLinks.map(({ href, text }) => (
            <Link
              key={href}
              className="flex items-center gap-2 text-2xl font-semibold text-foreground hover:text-foreground/80"
              to={href}
              onClick={() => handleMenuItemClick()}
            >
              {text}
              {href === '/inbox' && unreadCountData && unreadCountData.count > 0 && (
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {unreadCountData.count > 99 ? '99+' : unreadCountData.count}
                </span>
              )}
            </Link>
          ))}

          {!isPersonalLayout(organisations) && organisations.length > 0 && (
            <div className="w-full">
              <button
                className="flex items-center gap-2 text-lg font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowOrgs(!showOrgs)}
              >
                <Building2Icon className="h-4 w-4" />
                <Trans>Organisations</Trans>
                {showOrgs ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </button>
              {showOrgs && (
                <div className="mt-2 space-y-1 rounded-md border p-2">
                  {organisations.map((org) => (
                    <Link
                      key={org.id}
                      to={`/o/${org.url}`}
                      className={cn(
                        'block rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                        org.id === currentOrganisation?.id && 'bg-accent font-medium',
                      )}
                      onClick={handleMenuItemClick}
                    >
                      {org.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="text-2xl font-semibold text-destructive/80 hover:text-destructive"
            onClick={async () => authClient.signOut()}
          >
            <Trans>Sign Out</Trans>
          </button>
        </div>

        <div className="mt-auto flex w-full flex-col space-y-4 self-end">
          <div className="w-fit">
            <ThemeSwitcher />
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LohnLab
            <br />
            <Trans>All rights reserved.</Trans>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
