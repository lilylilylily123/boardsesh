'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { HistoryOutlined, SearchOutlined } from '@mui/icons-material';
import { BOULDER_GRADES } from '@/app/lib/board-data';
import { useSession } from 'next-auth/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { useInfiniteScroll } from '@/app/hooks/use-infinite-scroll';
import { useQueryClient } from '@tanstack/react-query';
import {
  GET_USER_ASCENTS_FEED,
  DELETE_TICK,
  type GetUserAscentsFeedQueryVariables,
  type GetUserAscentsFeedQueryResponse,
  type AscentFeedItem,
  type DeleteTickVariables,
} from '@/app/lib/graphql/operations/ticks';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import type { UserBoard } from '@boardsesh/shared-schema';
import LogbookFeedItem from './logbook-feed-item';
import styles from './library.module.css';
import feedStyles from '@/app/components/activity-feed/ascents-feed.module.css';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'flash' | 'send' | 'attempt';
type SortOption = 'recent' | 'hardest' | 'easiest' | 'mostAttempts' | 'oldest';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'flash', label: 'Flash' },
  { value: 'send', label: 'Send' },
  { value: 'attempt', label: 'Attempt' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'hardest', label: 'Hardest' },
  { value: 'easiest', label: 'Easiest' },
  { value: 'mostAttempts', label: 'Most attempts' },
  { value: 'oldest', label: 'Oldest' },
];

interface LogbookFeedProps {
  selectedBoard: UserBoard | null;
}

function LogbookItemSkeleton() {
  return (
    <MuiCard className={feedStyles.feedItem}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', gap: '12px' }}>
          <Skeleton variant="rounded" width={64} height={64} animation="wave" sx={{ flexShrink: 0 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Skeleton variant="rounded" width={80} height={24} animation="wave" />
              <Skeleton variant="rounded" width={100} height={16} animation="wave" />
            </Box>
            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Skeleton variant="rounded" width={40} height={24} animation="wave" />
              <Skeleton variant="rounded" width={48} height={24} animation="wave" />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </MuiCard>
  );
}

export default function LogbookFeed({ selectedBoard }: LogbookFeedProps) {
  const { data: session } = useSession();
  const { token } = useWsAuthToken();
  const userId = session?.user?.id;
  const boardType = selectedBoard?.boardType ?? undefined;

  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minGrade, setMinGrade] = useState<number | ''>('');
  const [maxGrade, setMaxGrade] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 350);
  }, []);

  // Cleanup debounce timer
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const statusParam = statusFilter === 'all' ? undefined : statusFilter;
  const climbNameParam = debouncedSearch || undefined;
  const minDifficultyParam = minGrade !== '' ? minGrade : undefined;
  const maxDifficultyParam = maxGrade !== '' ? maxGrade : undefined;
  const fromDateParam = fromDate || undefined;
  const toDateParam = toDate || undefined;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['logbookFeed', userId, boardType ?? 'all', statusParam ?? 'all', climbNameParam ?? '', sortBy, minDifficultyParam ?? '', maxDifficultyParam ?? '', fromDateParam ?? '', toDateParam ?? ''],
    queryFn: async ({ pageParam }) => {
      const client = createGraphQLHttpClient(token ?? null);
      const variables: GetUserAscentsFeedQueryVariables = {
        userId: userId!,
        input: {
          limit: PAGE_SIZE,
          offset: pageParam,
          ...(boardType ? { boardType } : {}),
          ...(statusParam ? { status: statusParam } : {}),
          ...(climbNameParam ? { climbName: climbNameParam } : {}),
          ...(sortBy === 'oldest' ? { sortBy: 'recent' as const, sortOrder: 'asc' as const } : sortBy !== 'recent' ? { sortBy } : {}),
          ...(minDifficultyParam ? { minDifficulty: minDifficultyParam } : {}),
          ...(maxDifficultyParam ? { maxDifficulty: maxDifficultyParam } : {}),
          ...(fromDateParam ? { fromDate: fromDateParam } : {}),
          ...(toDateParam ? { toDate: toDateParam } : {}),
        },
      };
      const response = await client.request<GetUserAscentsFeedQueryResponse>(
        GET_USER_ASCENTS_FEED,
        variables,
      );
      return response.userAscentsFeed;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) return undefined;
      return lastPageParam + lastPage.items.length;
    },
    enabled: !!userId && !!token,
    staleTime: 60 * 1000,
  });

  const items: AscentFeedItem[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasMore: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
  });

  const handleDelete = useCallback(async (uuid: string) => {
    try {
      const client = createGraphQLHttpClient(token ?? null);
      await client.request<{ deleteTick: boolean }, DeleteTickVariables>(DELETE_TICK, { uuid });
      queryClient.invalidateQueries({ queryKey: ['logbookFeed'] });
      showMessage('Tick deleted', 'success');
    } catch {
      showMessage('Failed to delete tick', 'error');
    }
  }, [token, queryClient, showMessage]);

  const showBoardType = !selectedBoard;
  const hasFilters = statusFilter !== 'all' || debouncedSearch.length > 0 || minGrade !== '' || maxGrade !== '' || fromDate !== '' || toDate !== '';

  const filterBar = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
      <TextField
        size="small"
        placeholder="Search climbs..."
        value={searchText}
        onChange={handleSearchChange}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
      />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            variant={statusFilter === opt.value ? 'filled' : 'outlined'}
            color={statusFilter === opt.value ? 'primary' : 'default'}
            onClick={() => setStatusFilter(opt.value)}
          />
        ))}
        <FormControl size="small" sx={{ ml: 'auto', minWidth: 130 }}>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            sx={{ borderRadius: '8px', fontSize: 13 }}
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <Select
            displayEmpty
            value={minGrade}
            onChange={(e) => setMinGrade(e.target.value as number | '')}
            sx={{ borderRadius: '8px', fontSize: 13 }}
          >
            <MenuItem value="">Min grade</MenuItem>
            {BOULDER_GRADES.map((g) => (
              <MenuItem key={g.difficulty_id} value={g.difficulty_id}>{g.difficulty_name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ flex: 1 }}>
          <Select
            displayEmpty
            value={maxGrade}
            onChange={(e) => setMaxGrade(e.target.value as number | '')}
            sx={{ borderRadius: '8px', fontSize: 13 }}
          >
            <MenuItem value="">Max grade</MenuItem>
            {BOULDER_GRADES.map((g) => (
              <MenuItem key={g.difficulty_id} value={g.difficulty_id}>{g.difficulty_name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          placeholder="From"
          label="From"
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
        />
        <TextField
          size="small"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          placeholder="To"
          label="To"
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
        />
      </Box>
    </Box>
  );

  if (isLoading) {
    return (
      <>
        {filterBar}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <LogbookItemSkeleton key={i} />
          ))}
        </Box>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {filterBar}
        <div className={styles.emptyContainer}>
          <HistoryOutlined className={styles.emptyIcon} />
          <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
            {hasFilters ? 'No matching climbs' : 'No logged climbs yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
            {hasFilters ? 'Try adjusting your filters.' : 'Tick your sends and they show up here.'}
          </Typography>
        </div>
      </>
    );
  }

  return (
    <>
      {filterBar}
      <div className={feedStyles.feed}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <LogbookFeedItem key={item.uuid} item={item} showBoardType={showBoardType} onDelete={handleDelete} />
          ))}
        </Box>

        <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2, minHeight: 20 }}>
          {isFetchingNextPage && <CircularProgress size={24} />}
        </Box>
      </div>
    </>
  );
}
