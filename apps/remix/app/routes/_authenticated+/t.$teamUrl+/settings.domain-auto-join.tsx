import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { AtSignIcon } from 'lucide-react';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Domain-Auto-Join`);
}

export default function TeamSettingsDomainAutoJoinPage() {
  const { t } = useLingui();
  const { toast } = useToast();
  const team = useCurrentTeam();
  const { refreshSession } = useSession();

  const utils = trpc.useUtils();

  const { data: teamData, isLoading } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const [domainAutoJoinEnabled, setDomainAutoJoinEnabled] = useState(false);
  const [domainAutoJoinDomain, setDomainAutoJoinDomain] = useState('');

  useEffect(() => {
    if (!teamData?.teamSettings) {
      return;
    }

    setDomainAutoJoinEnabled(teamData.teamSettings.domainAutoJoinEnabled ?? false);
    setDomainAutoJoinDomain(teamData.teamSettings.domainAutoJoinDomain ?? '');
  }, [teamData?.teamSettings]);

  const { mutateAsync: updateTeamSettings, isPending } = trpc.team.settings.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.team.get.invalidate({ teamReference: team.id }), refreshSession()]);
    },
  });

  const onSubmit = async () => {
    try {
      const result = await updateTeamSettings({
        teamId: team.id,
        data: {
          domainAutoJoinEnabled,
          domainAutoJoinDomain: domainAutoJoinDomain.trim() === '' ? null : domainAutoJoinDomain,
        },
      });

      if (result.domainAutoJoinSync) {
        toast({
          title: t`Einstellungen gespeichert`,
          description: t`Synchronisation: ${result.domainAutoJoinSync.usersMatched} passende Nutzerkonten verarbeitet; Organisation und Team-Zugriff wurden bei Bedarf aktualisiert.`,
        });

        return;
      }

      toast({
        title: t`Einstellungen gespeichert`,
      });
    } catch {
      toast({
        title: t`Etwas ist schiefgelaufen`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        title={t`Domain-Auto-Join`}
        subtitle={t`Nutzer werden diesem Team automatisch hinzugefügt, wenn ihre Konto-E-Mail zur konfigurierten Domain passt (z. B. @lohnlab.de). Beim Speichern mit aktiviertem Auto-Join werden auch bestehende Nutzerkonten nachträglich verarbeitet.`}
      />

      <fieldset disabled={isLoading || isPending} className="mt-6 max-w-lg space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="domain-auto-join-enabled" className="text-base">
              <Trans>Domain-Auto-Join aktivieren</Trans>
            </Label>
            <p className="text-sm text-muted-foreground">
              <Trans>
                Gilt auch für neue Registrierungen und nach erfolgter E-Mail-Bestätigung, sobald die
                Adresse zur Domain passt.
              </Trans>
            </p>
          </div>
          <Switch
            id="domain-auto-join-enabled"
            checked={domainAutoJoinEnabled}
            onCheckedChange={setDomainAutoJoinEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="domain-auto-join-domain">
            <AtSignIcon className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
            <Trans>E-Mail-Domain</Trans>
          </Label>
          <Input
            id="domain-auto-join-domain"
            placeholder={t`lohnlab.de`}
            value={domainAutoJoinDomain}
            onChange={(e) => setDomainAutoJoinDomain(e.target.value)}
            disabled={!domainAutoJoinEnabled}
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            <Trans>Nur den Hostnamen eintragen (ohne @). Beispiel: lohnlab.de</Trans>
          </p>
        </div>

        <Button type="button" onClick={onSubmit} loading={isPending}>
          <Trans>Speichern</Trans>
        </Button>
      </fieldset>
    </div>
  );
}
