import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import {
  Building2Icon,
  ChevronRightIcon,
  ChevronsUpDown,
  LogOutIcon,
  UserIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { useOptionalCurrentTeam } from '~/providers/team';

export const OrgMenuSwitcher = () => {
  const { user, organisations } = useSession();

  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);

  const isUserAdmin = isAdmin(user);

  const currentOrganisation = useOptionalCurrentOrganisation();
  const currentTeam = useOptionalCurrentTeam();

  const avatarFallback = user.name
    ? extractInitials(user.name)
    : user.email.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="menu-switcher"
          variant="none"
          className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
        >
          <AvatarWithText
            avatarSrc={formatAvatarUrl(user.avatarImageId)}
            avatarFallback={avatarFallback}
            primaryText={user.name}
            rightSideComponent={
              <ChevronsUpDown className="text-muted-foreground ml-auto h-4 w-4" />
            }
            textSectionClassName="hidden lg:flex"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="z-[60] ml-6 w-56 md:ml-0"
        align="end"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground text-xs">{user.email}</p>
        </div>

        <DropdownMenuSeparator />

        {isUserAdmin && (
          <DropdownMenuItem className="text-muted-foreground px-3 py-2" asChild>
            <Link to="/admin">
              <Trans>Admin panel</Trans>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem className="text-muted-foreground px-3 py-2" asChild>
          <Link to="/settings/profile">
            <UserIcon className="mr-2 h-4 w-4" />
            <Trans>Account</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-muted-foreground px-3 py-2"
          onClick={() => setLanguageSwitcherOpen(true)}
        >
          <Trans>Language</Trans>
        </DropdownMenuItem>

        {currentOrganisation && (
          <DropdownMenuItem className="text-muted-foreground px-3 py-2" asChild>
            <Link
              to={{
                pathname: `/o/${currentOrganisation.url}/support`,
                search: currentTeam ? `?team=${currentTeam.id}` : '',
              }}
            >
              <Trans>Support</Trans>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-muted-foreground px-3 py-2">
            <Building2Icon className="mr-2 h-4 w-4" />
            <Trans>Organisations</Trans>
            <ChevronRightIcon className="ml-auto h-4 w-4" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {organisations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className={cn(
                  'text-muted-foreground px-3 py-2',
                  org.id === currentOrganisation?.id && 'bg-accent font-medium',
                )}
                asChild
              >
                <Link to={`/o/${org.url}`}>
                  {org.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive/80 hover:!text-destructive px-3 py-2"
          onSelect={async () => authClient.signOut()}
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          <Trans>Sign Out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />
    </DropdownMenu>
  );
};
