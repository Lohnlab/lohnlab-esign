import type { HTMLAttributes } from 'react';
import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { cn } from '@documenso/ui/lib/utils';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavDesktopProps = HTMLAttributes<HTMLDivElement>;

export const AppNavDesktop = ({
  className,
  ...props
}: AppNavDesktopProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const { pathname } = useLocation();

  const currentTeam = useOptionalCurrentTeam();

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        label: msg`Documents`,
      },
      {
        href: `/t/${teamUrl}/templates`,
        label: msg`Templates`,
      },
    ];
  }, [currentTeam, organisations]);

  return (
    <div
      className={cn(
        'ml-8 hidden flex-1 items-center gap-x-12 md:flex',
        className,
      )}
      {...props}
    >
      <div>
        <AnimatePresence>
          {menuNavigationLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-x-6"
            >
              {menuNavigationLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    'text-muted-foreground dark:text-muted-foreground/60 focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2',
                    {
                      'text-foreground dark:text-muted-foreground': pathname?.startsWith(href),
                    },
                  )}
                >
                  {_(label)}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
