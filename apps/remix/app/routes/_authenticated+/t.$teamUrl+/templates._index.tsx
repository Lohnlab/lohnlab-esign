import { useCallback, useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, OrganisationType, TemplateType } from '@prisma/client';
import { Bird, FilterIcon, SearchIcon } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useParams, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { FolderType } from '@documenso/lib/types/folder-type';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@documenso/ui/primitives/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import hubspotLogoDark from '../../../../../../packages/assets/hubspot-logo-dark.png';
import hubspotLogoLight from '../../../../../../packages/assets/hubspot-logo-light.png';

import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { HubspotGuidanceDialog } from '~/components/dialogs/hubspot-guidance-dialog';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { EnvelopeUploadButton } from '~/components/general/envelope/envelope-upload-button';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { PeriodSelector } from '~/components/general/period-selector';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

const TEMPLATE_VIEWS = ['team', 'organisation'] as const;

export function meta() {
  return appMetaTags(msg`Templates`);
}

export default function TemplatesPage() {
  const { _ } = useLingui();
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const { folderId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;
  const queryParam = searchParams.get('query') || '';

  const [searchTerm, setSearchTerm] = useState(queryParam);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  useEffect(() => {
    const currentQuery = searchParams.get('query') || '';
    if (debouncedSearchTerm !== currentQuery) {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearchTerm) {
        params.set('query', debouncedSearchTerm);
      } else {
        params.delete('query');
      }
      params.delete('page');
      setSearchParams(params);
    }
  }, [debouncedSearchTerm]);

  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(TEMPLATE_VIEWS).withDefault('team'),
  );

  const [typeFilter, setTypeFilter] = useQueryState('type');

  const isOrgView = view === 'organisation';
  const showOrgFilter = organisation.type !== OrganisationType.PERSONAL;

  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>(
    'templates-bulk-selection',
    {},
  );
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [showHubspotGuide, setShowHubspotGuide] = useState(
    searchParams.get('from') === 'hubspot',
  );

  const selectedEnvelopeIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const documentRootPath = formatDocumentsPath(team.url);
  const templateRootPath = formatTemplatesPath(team.url);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isOrgView) {
      count += 1;
    }
    if (typeFilter) {
      count += 1;
    }
    const period = searchParams.get('period');
    if (period && period !== 'all') {
      count += 1;
    }
    return count;
  }, [isOrgView, typeFilter, searchParams]);

  const resolvedType = typeFilter
    ? (typeFilter.toUpperCase() as TemplateType)
    : undefined;

  const teamTemplatesQuery = trpc.template.findTemplates.useQuery(
    {
      page,
      perPage,
      folderId,
      query: debouncedSearchTerm || undefined,
      type: resolvedType,
    },
    {
      enabled: !isOrgView,
    },
  );

  const orgTemplatesQuery = trpc.template.findOrganisationTemplates.useQuery(
    {
      page,
      perPage,
      query: debouncedSearchTerm || undefined,
    },
    {
      enabled: isOrgView,
    },
  );

  const activeQuery = isOrgView ? orgTemplatesQuery : teamTemplatesQuery;

  const handleViewChange = useCallback((newView: string) => {
    if (newView !== 'team' && newView !== 'organisation') {
      return;
    }

    void setView(newView === 'team' ? null : newView);
  }, [setView]);

  const handleTypeChange = useCallback((newType: string) => {
    void setTypeFilter(newType === 'all' ? null : newType);
  }, [setTypeFilter]);

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.TEMPLATE}>
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        {!isOrgView && <FolderGrid type={FolderType.TEMPLATE} parentId={folderId ?? null} />}

        <div className="mt-8">
          <h1 className="text-3xl font-semibold md:text-4xl">
            <Trans>Templates</Trans>
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                className="h-10 pl-9"
                placeholder={_(msg`Vorlagen suchen...`)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-2">
                  <FilterIcon className="h-4 w-4" />
                  <Trans>Filter</Trans>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-4" align="start">
                {showOrgFilter && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      <Trans>Scope</Trans>
                    </Label>
                    <Select value={view} onValueChange={handleViewChange}>
                      <SelectTrigger className="h-9" data-testid="template-view-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team" data-testid="template-tab-team">
                          Team
                        </SelectItem>
                        <SelectItem value="organisation" data-testid="template-tab-organisation">
                          <Trans>Organisation</Trans>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <Trans>Type</Trans>
                  </Label>
                  <Select value={typeFilter || 'all'} onValueChange={handleTypeChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <Trans>All</Trans>
                      </SelectItem>
                      <SelectItem value={TemplateType.PUBLIC}>
                        <Trans>Public</Trans>
                      </SelectItem>
                      <SelectItem value={TemplateType.PRIVATE}>
                        <Trans>Private</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <Trans>Period</Trans>
                  </Label>
                  <PeriodSelector />
                </div>
              </PopoverContent>
            </Popover>

            {!folderId && (
              <EnvelopeUploadButton type={EnvelopeType.TEMPLATE} />
            )}

            <Button
              variant="outline"
              className="h-10 gap-2 px-3"
              onClick={() => setShowHubspotGuide(true)}
            >
              <img src={hubspotLogoDark} alt="HubSpot" className="h-8 dark:hidden" />
              <img src={hubspotLogoLight} alt="HubSpot" className="hidden h-8 dark:block" />
            </Button>
          </div>

          <div className="mt-6">
            {activeQuery.data && activeQuery.data.count === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
                <Bird className="h-12 w-12" strokeWidth={1.5} />

                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    {debouncedSearchTerm ? (
                      <Trans>Keine Vorlagen gefunden</Trans>
                    ) : (
                      <Trans>No templates yet</Trans>
                    )}
                  </h3>

                  <p className="mt-2 max-w-[50ch]">
                    {debouncedSearchTerm ? (
                      <Trans>Für deine Suche wurden keine Vorlagen gefunden.</Trans>
                    ) : isOrgView ? (
                      <Trans>No organisation templates have been shared with your team yet.</Trans>
                    ) : (
                      <Trans>
                        You have not created any templates yet. Upload a document to create your
                        first template.
                      </Trans>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <TemplatesTable
                data={activeQuery.data}
                isLoading={activeQuery.isLoading}
                isLoadingError={activeQuery.isLoadingError}
                documentRootPath={documentRootPath}
                templateRootPath={templateRootPath}
                enableSelection={!isOrgView}
                rowSelection={isOrgView ? {} : rowSelection}
                onRowSelectionChange={isOrgView ? undefined : setRowSelection}
              />
            )}
          </div>
        </div>

        {!isOrgView && (
          <>
            <EnvelopesTableBulkActionBar
              selectedCount={selectedEnvelopeIds.length}
              onMoveClick={() => setIsBulkMoveDialogOpen(true)}
              onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
              onClearSelection={() => setRowSelection({})}
            />

            <EnvelopesBulkMoveDialog
              envelopeIds={selectedEnvelopeIds}
              envelopeType={EnvelopeType.TEMPLATE}
              open={isBulkMoveDialogOpen}
              currentFolderId={folderId}
              onOpenChange={setIsBulkMoveDialogOpen}
              onSuccess={() => setRowSelection({})}
            />

            <EnvelopesBulkDeleteDialog
              envelopeIds={selectedEnvelopeIds}
              envelopeType={EnvelopeType.TEMPLATE}
              open={isBulkDeleteDialogOpen}
              onOpenChange={setIsBulkDeleteDialogOpen}
              onSuccess={() => setRowSelection({})}
            />
          </>
        )}
      </div>

      <HubspotGuidanceDialog
        open={showHubspotGuide}
        onOpenChange={setShowHubspotGuide}
      />
    </EnvelopeDropZoneWrapper>
  );
}
