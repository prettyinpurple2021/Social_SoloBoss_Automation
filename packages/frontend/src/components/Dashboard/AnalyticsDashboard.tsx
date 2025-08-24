import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Stack,
  LinearProgress,
  Divider,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  Visibility,
  ThumbUp,
  Share,
  Facebook,
  Instagram,
  Pinterest,
  X as XIcon,
  AutoAwesome
} from '@mui/icons-material';
import { Platform } from '@sma/shared/types/platform';
import { PLATFORM_COLORS } from '@sma/shared/constants/platforms';
import { analyticsApi, AnalyticsData } from '../../services';
import dayjs from 'dayjs';

// Types are now imported from the service

const platformIcons = {
  [Platform.FACEBOOK]: <Facebook />,
  [Platform.INSTAGRAM]: <Instagram />,
  [Platform.PINTEREST]: <Pinterest />,
  [Platform.X]: <XIcon />
};

export const AnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await analyticsApi.getAnalytics({ timeRange });
      if (response.success && response.data) {
        setAnalyticsData(response.data);
      } else {
        setError(response.error || 'Failed to load analytics data');
      }
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'post_published':
        return <AutoAwesome />;
      case 'high_engagement':
        return <TrendingUp />;
      case 'milestone_reached':
        return <ThumbUp />;
      default:
        return <AutoAwesome />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h3" gutterBottom>
          Analytics Dashboard
        </Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h3" gutterBottom>
          Analytics Dashboard
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!analyticsData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h3" gutterBottom>
          Analytics Dashboard
        </Typography>
        <Typography>No analytics data available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography 
          variant="h3"
          sx={{
            fontFamily: '"Kalnia Glaze", serif',
            background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 500
          }}
        >
          Analytics Dashboard
        </Typography>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <AutoAwesome />
                </Avatar>
                <Typography variant="h6">Total Posts</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {analyticsData.overview.totalPosts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Published in selected period
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <ThumbUp />
                </Avatar>
                <Typography variant="h6">Engagement</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {formatNumber(analyticsData.overview.totalEngagement)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUp color="success" fontSize="small" />
                <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                  {analyticsData.overview.engagementRate}% rate
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <Visibility />
                </Avatar>
                <Typography variant="h6">Reach</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {formatNumber(analyticsData.overview.totalReach)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unique accounts reached
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <Share />
                </Avatar>
                <Typography variant="h6">Impressions</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {formatNumber(analyticsData.overview.totalImpressions)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total content views
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Platform Breakdown */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Platform Performance
              </Typography>
              <Stack spacing={2}>
                {analyticsData.platformBreakdown.map((platform) => (
                  <Box key={platform.platform}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar
                        sx={{
                          bgcolor: PLATFORM_COLORS[platform.platform],
                          width: 32,
                          height: 32,
                          mr: 2
                        }}
                      >
                        {platformIcons[platform.platform]}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {platform.posts} posts • {formatNumber(platform.engagement)} engagement
                        </Typography>
                      </Box>
                      <Chip
                        label={`${platform.engagementRate}%`}
                        size="small"
                        color={platform.engagementRate > 15 ? 'success' : 'default'}
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(platform.engagementRate * 5, 100)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Performing Posts */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Performing Posts
              </Typography>
              <Stack spacing={2}>
                {analyticsData.topPosts.map((post, index) => (
                  <Box key={post.id}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Chip
                        label={`#${index + 1}`}
                        size="small"
                        color="primary"
                        sx={{ mt: 0.5 }}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {post.content.length > 80 
                            ? `${post.content.substring(0, 80)}...` 
                            : post.content
                          }
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar
                            sx={{
                              bgcolor: PLATFORM_COLORS[post.platform],
                              width: 20,
                              height: 20
                            }}
                          >
                            {platformIcons[post.platform]}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {formatNumber(post.engagement)} engagement
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(post.publishedAt).fromNow()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    {index < analyticsData.topPosts.length - 1 && (
                      <Divider sx={{ mt: 2 }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Stack spacing={2}>
                {analyticsData.recentActivity.map((activity) => (
                  <Box key={activity.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: activity.platform ? PLATFORM_COLORS[activity.platform] : 'primary.main',
                        width: 40,
                        height: 40
                      }}
                    >
                      {activity.platform ? platformIcons[activity.platform] : getActivityIcon(activity.type)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {activity.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(activity.timestamp).fromNow()}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};