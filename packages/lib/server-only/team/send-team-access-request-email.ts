import { mailer } from '@documenso/email/mailer';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '@documenso/lib/constants/email';
import { env } from '@documenso/lib/utils/env';

export const getTeamAccessRequestAdminEmail = (): string => {
  const configured = env('NEXT_PRIVATE_TEAM_ACCESS_REQUEST_EMAIL')?.trim();

  if (configured) {
    return configured;
  }

  return 'lr@lohnlab.de';
};

export type SendTeamAccessRequestEmailOptions = {
  requestingUserName: string | null;
  requestingUserEmail: string;
  teamName: string;
  teamUrl: string;
  pagePath: string;
};

export const sendTeamAccessRequestEmail = async ({
  requestingUserName,
  requestingUserEmail,
  teamName,
  teamUrl,
  pagePath,
}: SendTeamAccessRequestEmailOptions): Promise<void> => {
  const adminEmail = getTeamAccessRequestAdminEmail();
  const baseUrl = (NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000').replace(/\/$/, '');
  const fullLink = `${baseUrl}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`;

  const subject = `Zugriffsanfrage: ${teamName} (${teamUrl}) — ${requestingUserEmail}`;

  const textBody = [
    'Ein Nutzer hat Zugriff auf ein Team angefordert.',
    '',
    `Team: ${teamName} (URL-Slug: ${teamUrl})`,
    `Nutzer: ${requestingUserName ?? '—'} <${requestingUserEmail}>`,
    `Aufgerufener Link: ${fullLink}`,
    '',
    'Bitte prüfen und den Nutzer ggf. in der Organisation bzw. dem Team hinzufügen.',
  ].join('\n');

  const htmlBody = `<p>Ein Nutzer hat Zugriff auf ein Team angefordert.</p>
<ul>
<li><strong>Team</strong>: ${escapeHtml(teamName)} (${escapeHtml(teamUrl)})</li>
<li><strong>Nutzer</strong>: ${escapeHtml(requestingUserName ?? '—')} &lt;${escapeHtml(requestingUserEmail)}&gt;</li>
<li><strong>Link</strong>: <a href="${escapeHtml(fullLink)}">${escapeHtml(fullLink)}</a></li>
</ul>
<p>Bitte prüfen und den Nutzer ggf. in der Organisation bzw. dem Team hinzufügen.</p>`;

  await mailer.sendMail({
    to: {
      address: adminEmail,
      name: 'LohnLab Admin',
    },
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject,
    text: textBody,
    html: htmlBody,
  });
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
