'use client';

import React, { useState, useCallback } from 'react';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MuiTypography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ElectricBoltOutlined from '@mui/icons-material/ElectricBoltOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AscentThumbnail from '@/app/components/activity-feed/ascent-thumbnail';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';
import { themeTokens } from '@/app/theme/theme-config';
import styles from '@/app/components/activity-feed/ascents-feed.module.css';

dayjs.extend(relativeTime);

// Layout name mapping (same as ascents-feed.tsx)
const layoutNames: Record<string, string> = {
  'kilter-1': 'Kilter Original',
  'kilter-8': 'Kilter Homewall',
  'tension-9': 'Tension Classic',
  'tension-10': 'Tension 2 Mirror',
  'tension-11': 'Tension 2 Spray',
  'moonboard-1': 'MoonBoard 2010',
  'moonboard-2': 'MoonBoard 2016',
  'moonboard-3': 'MoonBoard 2024',
  'moonboard-4': 'MoonBoard Masters 2017',
  'moonboard-5': 'MoonBoard Masters 2019',
};

const getLayoutDisplayName = (boardType: string, layoutId: number | null): string => {
  if (layoutId === null) return boardType.charAt(0).toUpperCase() + boardType.slice(1);
  const key = `${boardType}-${layoutId}`;
  return layoutNames[key] || boardType.charAt(0).toUpperCase() + boardType.slice(1);
};

const getStatusDisplay = (status: AscentFeedItem['status'], attemptCount: number) => {
  switch (status) {
    case 'flash':
      return { label: 'Flashed', icon: <ElectricBoltOutlined />, color: 'gold' as const };
    case 'send':
      return { label: attemptCount > 1 ? `Sent in ${attemptCount}` : 'Sent', icon: <CheckCircleOutlined />, color: 'green' as const };
    case 'attempt':
      return { label: attemptCount === 1 ? '1 attempt' : `${attemptCount} attempts`, icon: <CancelOutlined />, color: 'default' as const };
  }
};

interface LogbookFeedItemProps {
  item: AscentFeedItem;
  showBoardType?: boolean;
  onDelete?: (uuid: string) => void;
}

const LogbookFeedItem: React.FC<LogbookFeedItemProps> = ({ item, showBoardType, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleDelete = useCallback(() => {
    handleMenuClose();
    onDelete?.(item.uuid);
  }, [onDelete, item.uuid, handleMenuClose]);

  const timeAgo = dayjs(item.climbedAt).fromNow();
  const statusDisplay = getStatusDisplay(item.status, item.attemptCount);
  const boardDisplay = getLayoutDisplayName(item.boardType, item.layoutId);
  const hasSuccess = item.status === 'flash' || item.status === 'send';

  return (
    <MuiCard className={styles.feedItem}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', gap: '12px' }}>
          {item.frames && item.layoutId && (
            <AscentThumbnail
              boardType={item.boardType}
              layoutId={item.layoutId}
              angle={item.angle}
              climbUuid={item.climbUuid}
              climbName={item.climbName}
              frames={item.frames}
              isMirror={item.isMirror}
            />
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <Chip
                  icon={statusDisplay.icon as React.ReactElement}
                  label={statusDisplay.label}
                  size="small"
                  color={statusDisplay.color === 'green' ? 'success' : undefined}
                  sx={statusDisplay.color === 'gold' ? { bgcolor: themeTokens.colors.amber, color: 'var(--neutral-900)' } : undefined}
                  className={styles.statusTag}
                />
                <MuiTypography variant="body2" component="span" fontWeight={600} className={styles.climbName}>
                  {item.climbName}
                </MuiTypography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.timeAgo}>
                  {timeAgo}
                </MuiTypography>
                {onDelete && (
                  <>
                    <IconButton size="small" onClick={handleMenuOpen} sx={{ ml: 0.25, p: 0.5 }}>
                      <MoreVertOutlined sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Menu
                      anchorEl={anchorEl}
                      open={menuOpen}
                      onClose={handleMenuClose}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <MuiMenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                        <ListItemIcon><DeleteOutlined sx={{ color: 'error.main' }} /></ListItemIcon>
                        <ListItemText>Delete</ListItemText>
                      </MuiMenuItem>
                    </Menu>
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {item.difficultyName && (
                <Chip label={item.difficultyName} size="small" color="primary" />
              )}
              <Chip icon={<LocationOnOutlined />} label={`${item.angle}\u00B0`} size="small" />
              {showBoardType && (
                <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.boardType}>
                  {boardDisplay}
                </MuiTypography>
              )}
              {item.isMirror && <Chip label="Mirrored" size="small" color="secondary" />}
              {item.isBenchmark && <Chip label="Benchmark" size="small" />}
            </Box>

            {hasSuccess && item.quality && (
              <Rating readOnly value={item.quality} max={5} className={styles.rating} />
            )}

            {item.setterUsername && (
              <MuiTypography variant="body2" component="span" color="text.secondary" className={styles.setter}>
                Set by {item.setterUsername}
              </MuiTypography>
            )}

            {item.comment && (
              <MuiTypography variant="body2" component="span" className={styles.comment}>
                {item.comment}
              </MuiTypography>
            )}
          </Box>
        </Box>
      </CardContent>
    </MuiCard>
  );
};

export default React.memo(LogbookFeedItem);
