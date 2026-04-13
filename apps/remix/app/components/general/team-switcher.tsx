import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon, UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@documenso/ui/primitives/popover';

import { useOptionalCurrentTeam } from '~/providers/team';

export const TeamSwitcher = () => {
  const { _ } = useLingui();
  const { organisations } = useSession();
  const navigate = useNavigate();

  const currentTeam = useOptionalCurrentTeam();
  const currentOrganisation = useOptionalCurrentOrganisation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const personalTeam = useMemo(() => {
    const personalOrg = organisations.find((org) => org.type === 'PERSONAL');
    return personalOrg?.teams[0] ?? null;
  }, [organisations]);

  const isOnPersonalTeam = currentTeam?.id === personalTeam?.id;

  const teams = useMemo(() => {
    const org = currentOrganisation || organisations.find((o) => o.type !== 'PERSONAL') || organisations[0];

    if (!org) {
      return [];
    }

    return org.teams;
  }, [currentOrganisation, organisations]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) {
      return teams;
    }

    const lower = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(lower));
  }, [teams, search]);

  const displayedOrg = currentOrganisation || organisations.find((o) => o.type !== 'PERSONAL') || organisations[0];

  const handleSelectTeam = (teamUrl: string) => {
    setOpen(false);
    setSearch('');
    void navigate(`/t/${teamUrl}/documents`);
  };

  if (teams.length === 0 && !personalTeam) {
    return null;
  }

  const triggerLabel = currentTeam?.name ?? <Trans>Team</Trans>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-3"
          aria-label={_(msg`Team wechseln`)}
        >
          {isOnPersonalTeam ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
              <UserIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          ) : currentTeam ? (
            <Avatar className="h-5 w-5">
              {currentTeam.avatarImageId && (
                <AvatarImage src={formatAvatarUrl(currentTeam.avatarImageId)} />
              )}
              <AvatarFallback className="text-[10px]">
                {currentTeam.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          ) : null}
          <span className="max-w-[120px] truncate text-sm">
            {isOnPersonalTeam ? <Trans>Privat</Trans> : triggerLabel}
          </span>
          <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="center">
        {teams.length > 3 && (
          <div className="border-b p-2">
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                type="search"
                className="h-8 pl-7 text-sm"
                placeholder={_(msg`Team suchen...`)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto p-1">
          {personalTeam && (!search.trim() || _(msg`Privat`).toLowerCase().includes(search.toLowerCase())) && (
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                isOnPersonalTeam && 'bg-accent',
              )}
              onClick={() => handleSelectTeam(personalTeam.url)}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="min-w-0 flex-1 truncate text-left">
                <Trans>Privat</Trans>
              </span>
              {isOnPersonalTeam && (
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          )}

          {personalTeam && filteredTeams.length > 0 && (!search.trim() || _(msg`Privat`).toLowerCase().includes(search.toLowerCase())) && (
            <div className="my-1 border-t" />
          )}

          {filteredTeams.map((team) => (
            <button
              key={team.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                team.id === currentTeam?.id && !isOnPersonalTeam && 'bg-accent',
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
              <span className="min-w-0 flex-1 truncate text-left">{team.name}</span>
              {team.id === currentTeam?.id && !isOnPersonalTeam && (
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}

          {filteredTeams.length === 0 && (!personalTeam || (search.trim() && !_(msg`Privat`).toLowerCase().includes(search.toLowerCase()))) && (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              <Trans>Kein Team gefunden</Trans>
            </p>
          )}
        </div>

        {displayedOrg && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-sm" asChild>
              <Link
                to={`/o/${displayedOrg.url}/settings/teams?action=add-team`}
                onClick={() => setOpen(false)}
              >
                <PlusIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Neues Team</Trans>
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
