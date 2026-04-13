import { useCallback, useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { FolderType, OrganisationType } from '@prisma/client';
import { FilterIcon, SearchIcon } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { z } from 'zod';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { STATS_COUNT_CAP } from '@documenso/lib/constants/document';
import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { ZFindDocumentsInternalRequestSchema } from '@documenso/trpc/server/document-router/find-documents-internal.types';
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

import { DocumentMoveToFolderDialog } from '~/components/dialogs/document-move-to-folder-dialog';
import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { DocumentStatus } from '~/components/general/document/document-status';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { EnvelopeUploadButton } from '~/components/general/envelope/envelope-upload-button';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { PeriodSelector } from '~/components/general/period-selector';
import { DocumentsTable } from '~/components/tables/documents-table';
import { DocumentsTableEmptyState } from '~/components/tables/documents-table-empty-state';
import { DocumentsTableSenderFilter } from '~/components/tables/documents-table-sender-filter';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Documents`);
}

const ZSearchParamsSchema = ZFindDocumentsInternalRequestSchema.pick({
  status: true,
  period: true,
  page: true,
  perPage: true,
  query: true,
}).extend({
  senderIds: z.string().transform(parseToIntegerArray).optional().catch([]),
});

export default function DocumentsPage() {
  const { _ } = useLingui();
  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { folderId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<number | null>(null);

  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>(
    'documents-bulk-selection',
    {},
  );
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  const selectedEnvelopeIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const [stats, setStats] = useState<TFindDocumentsInternalResponse['stats']>({
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.REJECTED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  });

  const findDocumentSearchParams = useMemo(
    () => ZSearchParamsSchema.safeParse(Object.fromEntries(searchParams.entries())).data || {},
    [searchParams],
  );

  const [searchTerm, setSearchTerm] = useState(findDocumentSearchParams.query || '');
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

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery(
    {
      ...findDocumentSearchParams,
      folderId,
    },
    {
      ...SKIP_QUERY_BATCH_META,
    },
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (findDocumentSearchParams.status && findDocumentSearchParams.status !== 'ALL') {
      count += 1;
    }
    if (findDocumentSearchParams.senderIds && findDocumentSearchParams.senderIds.length > 0) {
      count += 1;
    }
    if (findDocumentSearchParams.period) {
      count += 1;
    }
    return count;
  }, [findDocumentSearchParams]);

  const getStatusHref = useCallback((value: keyof typeof ExtendedDocumentStatus) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (value === ExtendedDocumentStatus.ALL) {
      params.delete('status');
    }

    if (value === ExtendedDocumentStatus.INBOX && organisation.type === OrganisationType.PERSONAL) {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    let path = formatDocumentsPath(team.url);

    if (folderId) {
      path += `/f/${folderId}`;
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    return path;
  }, [searchParams, organisation.type, team.url, folderId]);

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  const statusOptions = useMemo(() => {
    const options = [
      ExtendedDocumentStatus.INBOX,
      ExtendedDocumentStatus.PENDING,
      ExtendedDocumentStatus.COMPLETED,
      ExtendedDocumentStatus.DRAFT,
      ExtendedDocumentStatus.ALL,
    ].filter((value) => {
      if (organisation.type === OrganisationType.PERSONAL) {
        return value !== ExtendedDocumentStatus.INBOX;
      }
      return true;
    });
    return options;
  }, [organisation.type]);

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.DOCUMENT}>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <FolderGrid type={FolderType.DOCUMENT} parentId={folderId ?? null} />

        <div className="mt-8">
          <h2 className="text-3xl font-semibold md:text-4xl">
            <Trans>Documents</Trans>
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                className="h-10 pl-9"
                placeholder={_(msg`Dokumente suchen...`)}
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map((value) => (
                      <Button
                        key={value}
                        variant={
                          (findDocumentSearchParams.status || 'ALL') === value
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        className="h-7 text-xs"
                        asChild
                      >
                        <Link to={getStatusHref(value)} preventScrollReset>
                          <DocumentStatus status={value} />
                          {value !== ExtendedDocumentStatus.ALL && (
                            <span className="ml-1 opacity-60">
                              {stats[value] >= STATS_COUNT_CAP
                                ? `${STATS_COUNT_CAP.toLocaleString()}+`
                                : stats[value]}
                            </span>
                          )}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>

                {team && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      <Trans>Sender</Trans>
                    </Label>
                    <DocumentsTableSenderFilter teamId={team.id} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <Trans>Period</Trans>
                  </Label>
                  <PeriodSelector />
                </div>
              </PopoverContent>
            </Popover>

            {!folderId && (
              <EnvelopeUploadButton type={EnvelopeType.DOCUMENT} />
            )}
          </div>
        </div>

        <div className="mt-6">
          <div>
            {data && data.count === 0 ? (
              <DocumentsTableEmptyState
                status={findDocumentSearchParams.status || ExtendedDocumentStatus.ALL}
              />
            ) : (
              <DocumentsTable
                data={data}
                isLoading={isLoading}
                isLoadingError={isLoadingError}
                onMoveDocument={(documentId) => {
                  setDocumentToMove(documentId);
                  setIsMovingDocument(true);
                }}
                enableSelection
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            )}
          </div>
        </div>

        {documentToMove && (
          <DocumentMoveToFolderDialog
            documentId={documentToMove}
            open={isMovingDocument}
            currentFolderId={folderId}
            onOpenChange={(open) => {
              setIsMovingDocument(open);

              if (!open) {
                setDocumentToMove(null);
              }
            }}
          />
        )}

        <EnvelopesTableBulkActionBar
          selectedCount={selectedEnvelopeIds.length}
          onMoveClick={() => setIsBulkMoveDialogOpen(true)}
          onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />

        <EnvelopesBulkMoveDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.DOCUMENT}
          open={isBulkMoveDialogOpen}
          currentFolderId={folderId}
          onOpenChange={setIsBulkMoveDialogOpen}
          onSuccess={() => setRowSelection({})}
        />

        <EnvelopesBulkDeleteDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.DOCUMENT}
          open={isBulkDeleteDialogOpen}
          onOpenChange={setIsBulkDeleteDialogOpen}
          onSuccess={() => setRowSelection({})}
        />
      </div>
    </EnvelopeDropZoneWrapper>
  );
}
