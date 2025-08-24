import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Fab,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Avatar,
  LinearProgress,
  Alert
} from '@mui/material';
import {

  Schedule,
  CheckCircle,
  Error,
  Add,
  Refresh,
  FilterList,
  Facebook,
  Instagram,
  Pinterest,
  Twitter
} from '@mui/icons-material';
import { useResponsive } from '../../hooks/useResponsive';
import { HapticUtils } from '../../utils/mobile';

interface Post {
  id: string;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledTime?: Date;
  publishedTime?: Date;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
  };
}

interface MobileDashboardProps {
  posts: Post[];
  onCreatePost: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const platformIcons: Record<string, React.ReactNode> = {
  facebook: <Facebook fontSize="small" />,
  instagram: <Instagram fontSize="small" />,
  pinterest: <Pinterest fontSize="small" />,
  twitter: <Twitter fontSize="small" />
};

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  scheduled: 'info',
  published: 'success',
  failed: 'error'
};

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  posts,
  onCreatePost,
  onRefresh,
  isLoading = false
}) => {
  const { isMobile } = useResponsive();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredPosts = posts.filter(post => {
    if (selectedFilter === 'all') return true;
    return post.status === selectedFilter;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    drafts: posts.filter(p => p.status === 'draft').length,
    failed: posts.filter(p => p.status === 'failed').length
  };

  const handleRefresh = () => {
    HapticUtils.mediumTap();
    onRefresh();
  };

  const handleFilterSelect = (filter: string) => {
    HapticUtils.lightTap();
    setSelectedFilter(filter);
    setFilterDrawerOpen(false);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle color="success" fontSize="small" />;
      case 'scheduled':
        return <Schedule color="info" fontSize="small" />;
      case 'failed':
        return <Error color="error" fontSize="small" />;
      default:
        return null;
    }
  };

  if (!isMobile) {
    return null; // Use desktop dashboard for non-mobile
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}> {/* Extra bottom padding for navigation */}
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <Card sx={{ textAlign: 'center' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="primary">
                {stats.published}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Published
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ textAlign: 'center' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="info.main">
                {stats.scheduled}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scheduled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Recent Posts ({filteredPosts.length})
        </Typography>
        <Box>
          <IconButton onClick={() => setFilterDrawerOpen(true)}>
            <FilterList />
          </IconButton>
          <IconButton onClick={handleRefresh} disabled={isLoading}>
            <Refresh sx={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Loading Indicator */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Posts List */}
      <Box sx={{ mb: 2 }}>
        {filteredPosts.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedFilter === 'all' 
              ? 'No posts yet. Create your first post!'
              : `No ${selectedFilter} posts found.`
            }
          </Alert>
        ) : (
          filteredPosts.map((post) => (
            <Card key={post.id} sx={{ mb: 2 }}>
              <CardContent>
                {/* Post Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {post.content.length > 100 
                        ? `${post.content.substring(0, 100)}...`
                        : post.content
                      }
                    </Typography>
                  </Box>
                  {getStatusIcon(post.status)}
                </Box>

                {/* Platforms */}
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                  {post.platforms.map((platform) => (
                    <Avatar
                      key={platform}
                      sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}
                    >
                      {platformIcons[platform]}
                    </Avatar>
                  ))}
                </Box>

                {/* Status and Time */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    size="small"
                    color={statusColors[post.status]}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {post.status === 'scheduled' && post.scheduledTime
                      ? formatDate(post.scheduledTime)
                      : post.publishedTime
                      ? formatDate(post.publishedTime)
                      : 'Draft'
                    }
                  </Typography>
                </Box>

                {/* Engagement (if published) */}
                {post.status === 'published' && post.engagement && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    <Typography variant="caption">
                      👍 {post.engagement.likes}
                    </Typography>
                    <Typography variant="caption">
                      🔄 {post.engagement.shares}
                    </Typography>
                    <Typography variant="caption">
                      💬 {post.engagement.comments}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      {/* Create Post FAB */}
      <Fab
        color="primary"
        onClick={() => {
          HapticUtils.mediumTap();
          onCreatePost();
        }}
        sx={{
          position: 'fixed',
          bottom: 80, // Above bottom navigation
          right: 16,
          zIndex: 1000
        }}
      >
        <Add />
      </Fab>

      {/* Filter Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        onOpen={() => setFilterDrawerOpen(true)}
        sx={{
          '& .MuiDrawer-paper': {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '50vh'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Filter Posts
          </Typography>
          <List>
            {[
              { key: 'all', label: 'All Posts', count: stats.total },
              { key: 'published', label: 'Published', count: stats.published },
              { key: 'scheduled', label: 'Scheduled', count: stats.scheduled },
              { key: 'draft', label: 'Drafts', count: stats.drafts },
              { key: 'failed', label: 'Failed', count: stats.failed }
            ].map((filter) => (
              <ListItem
                key={filter.key}
                onClick={() => handleFilterSelect(filter.key)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 2,
                  mb: 0.5,
                  bgcolor: selectedFilter === filter.key ? 'primary.main' : 'transparent',
                  color: selectedFilter === filter.key ? 'white' : 'inherit',
                  '&:hover': {
                    bgcolor: selectedFilter === filter.key ? 'primary.dark' : 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                <ListItemText primary={filter.label} />
                <Chip
                  label={filter.count}
                  size="small"
                  sx={{
                    bgcolor: selectedFilter === filter.key ? 'rgba(255, 255, 255, 0.2)' : 'primary.main',
                    color: 'white'
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </SwipeableDrawer>

      {/* CSS for spin animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};