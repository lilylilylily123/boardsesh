'use client';

import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { HistoryOutlined } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { useInfiniteScroll } from '@/app/hooks/use-infinite-scroll';
import {
  GET_USER_ASCENTS_FEED,
  type GetUserAscentsFeedQueryVariables,
  type GetUserAscentsFeedQueryResponse,
  type AscentFeedItem,
} from '@/app/lib/graphql/operations/ticks';
import type { UserBoard } from '@boardsesh/shared-schema';
import LogbookFeedItem from './logbook-feed-item';
import styles from './library.module.css';
import feedStyles from '@/app/components/activity-feed/ascents-feed.module.css';

const PAGE_SIZE = 20;

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['logbookFeed', userId, boardType ?? 'all'],
    queryFn: async ({ pageParam }) => {
      const client = createGraphQLHttpClient(token ?? null);
      const variables: GetUserAscentsFeedQueryVariables = {
        userId: userId!,
        input: {
          limit: PAGE_SIZE,
          offset: pageParam,
          ...(boardType ? { boardType } : {}),
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

  const showBoardType = !selectedBoard;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <LogbookItemSkeleton key={i} />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <HistoryOutlined className={styles.emptyIcon} />
        <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
          No logged climbs yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
          Tick your sends and they show up here.
        </Typography>
      </div>
    );
  }

  return (
    <div className={feedStyles.feed}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item) => (
          <LogbookFeedItem key={item.uuid} item={item} showBoardType={showBoardType} />
        ))}
      </Box>

      <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2, minHeight: 20 }}>
        {isFetchingNextPage && <CircularProgress size={24} />}
      </Box>
    </div>
  );
}
