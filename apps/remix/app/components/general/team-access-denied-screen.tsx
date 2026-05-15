import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { MailIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';

export type TeamAccessDeniedScreenProps = {
  teamUrl: string;
};

export const TeamAccessDeniedScreen = ({ teamUrl }: TeamAccessDeniedScreenProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isLoading, isError } = trpc.team.access.checkUrl.useQuery(
    {
      teamUrl,
    },
    {
      staleTime: 60_000,
    },
  );

  const { mutateAsync: requestAccess, isPending: isRequesting } =
    trpc.team.access.requestFromAdmin.useMutation();

  useEffect(() => {
    if (data?.kind !== 'HAS_ACCESS') {
      return;
    }

    void navigate(formatDocumentsPath(teamUrl), { replace: true });
  }, [data?.kind, navigate, teamUrl]);

  if (isLoading) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Wird geladen…`,
            subHeading: msg`Team`,
            message: msg`Bitte einen Moment warten.`,
          },
        }}
        secondaryButton={null}
      />
    );
  }

  if (isError || !data) {
    return (
      <GenericErrorLayout
        errorCode={500}
        errorCodeMap={{
          500: {
            heading: msg`Etwas ist schiefgelaufen`,
            subHeading: msg`Fehler`,
            message: msg`Der Team-Status konnte nicht geladen werden. Bitte versuche es erneut.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to="/">
              <Trans>Zur Startseite</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  if (data.kind === 'NOT_FOUND') {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Team nicht gefunden`,
            subHeading: msg`404 Team nicht gefunden`,
            message: msg`Das Team existiert nicht oder der Link ist ungültig.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to="/">
              <Trans>Zur Startseite</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  if (data.kind === 'NO_MEMBERSHIP') {
    const onRequestAdmin = async () => {
      try {
        await requestAccess({
          teamUrl,
          pagePath: `${location.pathname}${location.search}`,
        });

        toast({
          title: t`Anfrage gesendet`,
          description: t`Der Administrator wurde per E-Mail informiert.`,
        });
      } catch {
        toast({
          title: t`Senden fehlgeschlagen`,
          description: t`Die Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.`,
          variant: 'destructive',
        });
      }
    };

    return (
      <GenericErrorLayout
        errorCode={403}
        errorCodeMap={{
          403: {
            heading: msg`Kein Zugriff auf dieses Team`,
            subHeading: msg`Team`,
            message: msg`Du bist leider nicht Teil dieses Teams. Bitte kontaktiere den Administrator, damit du hinzugefügt werden kannst.`,
          },
        }}
        primaryButton={
          <Button
            type="button"
            onClick={onRequestAdmin}
            loading={isRequesting}
            disabled={isRequesting}
          >
            <MailIcon className="mr-2 h-4 w-4" aria-hidden />
            <Trans>Administrator kontaktieren</Trans>
          </Button>
        }
        secondaryButton={
          <Button asChild variant="outline">
            <Link to="/">
              <Trans>Zur Startseite</Trans>
            </Link>
          </Button>
        }
      >
        <p className="mt-4 text-sm text-muted-foreground">
          <Trans>Team</Trans>: {data.teamName} · <Trans>Organisation</Trans>:{' '}
          {data.organisationName}
        </p>
      </GenericErrorLayout>
    );
  }

  return null;
};
