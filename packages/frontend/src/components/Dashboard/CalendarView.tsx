import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
  Stack,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Pinterest,
  X as XIcon,
  Schedule,
  CheckCircle,
  Error,
  Edit,
  Sync
} from '@mui/icons-material';
import { Post, PostStatus } from '@sma/shared/types/post';
import { Platform } from '@sma/shared/types/platform';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

interface CalendarViewProps {
  posts?: Post[];
  onPostClick?: (post: Post) => void;
}

const platformIcons = {
  [Platform.FACEBOOK]: <Facebook fontSize="small" />,
  [Platform.INSTAGRAM]: <Instagram fontSize="small" />,
  [Platform.PINTEREST]: <Pinterest fontSize="small" />,
  [Platform.X]: <XIcon fontSize="small" />
};

const platformColors = {
  [Platform.FACEBOOK]: '#1877F2',
  [Platform.INSTAGRAM]: '#E4405F',
  [Platform.PINTEREST]: '#BD081C',
  [Platform.X]: '#000000'
};

const statusIcons = {
  [PostStatus.DRAFT]: <Edit fontSize="small" />,
  [PostStatus.SCHEDULED]: <Schedule fontSize="small" />,
  [PostStatus.PUBLISHING]: <Sync fontSize="small" />,
  [PostStatus.PUBLISHED]: <CheckCircle fontSize="small" />,
  [PostStatus.FAILED]: <Error fontSize="small" />
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  posts = []
}) => {
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedDatePosts, setSelectedDatePosts] = useState<Post[]>([]);
  const [mockPosts, setMockPosts] = useState<Post[]>([]);

  // Mock data for demonstration
  useEffect(() => {
    const now = dayjs();
    const mockData: Post[] = [
      {
        id: '1',
        userId: 'user1',
        content: 'Morning motivation post',
        images: [],
        hashtags: ['#motivation'],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        scheduledTime: now.add(1, 'day').hour(9).minute(0).toDate(),
        status: PostStatus.SCHEDULED,
        source: 'manual' as any,
        platformPosts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        userId: 'user1',
        content: 'Weekly newsletter announcement',
        images: [],
        hashtags: ['#newsletter'],
        platforms: [Platform.X, Platform.PINTEREST],
        scheduledTime: now.add(2, 'day').hour(14).minute(30).toDate(),
        status: PostStatus.SCHEDULED,
        source: 'manual' as any,
        platformPosts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        userId: 'user1',
        content: 'Product launch announcement',
        images: [],
        hashtags: ['#launch', '#product'],
        platforms: [Platform.FACEBOOK, Platform.X],
        scheduledTime: now.add(3, 'day').hour(16).minute(0).toDate(),
        status: PostStatus.SCHEDULED,
        source: 'soloboss' as any,
        platformPosts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        userId: 'user1',
        content: 'Published blog post',
        images: [],
        hashtags: ['#blog'],
        platforms: [Platform.INSTAGRAM],
        scheduledTime: now.subtract(1, 'day').hour(12).minute(0).toDate(),
        status: PostStatus.PUBLISHED,
        source: 'blogger' as any,
        platformPosts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    setMockPosts(mockData);
  }, []);

  const displayPosts = posts.length > 0 ? posts : mockPosts;

  const getPostsForDate = (date: Dayjs): Post[] => {
    return displayPosts.filter(post => {
      if (!post.scheduledTime) return false;
      const postDate = dayjs(post.scheduledTime);
      return postDate.format('YYYY-MM-DD') === date.format('YYYY-MM-DD');
    });
  };

  const handlePreviousMonth = () => {
    setCurrentDate(currentDate.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate(currentDate.add(1, 'month'));
  };

  const handleDateClick = (date: Dayjs) => {
    const postsForDate = getPostsForDate(date);
    if (postsForDate.length > 0) {
      setSelectedDate(date);
      setSelectedDatePosts(postsForDate);
    }
  };

  const handleCloseDialog = () => {
    setSelectedDate(null);
    setSelectedDatePosts([]);
  };

  const renderCalendarDays = () => {
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    const startOfCalendar = startOfMonth.startOf('week');
    const endOfCalendar = endOfMonth.endOf('week');

    const days = [];
    let day = startOfCalendar;

    while (day.isSameOrBefore(endOfCalendar, 'day')) {
      days.push(day);
      day = day.add(1, 'day');
    }

    return days.map((date) => {
      const postsForDate = getPostsForDate(date);
      const isCurrentMonth = date.format('YYYY-MM') === currentDate.format('YYYY-MM');
      const isToday = date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');

      return (
        <Grid item xs key={date.format('YYYY-MM-DD')}>
          <Card
            sx={{
              minHeight: 120,
              cursor: postsForDate.length > 0 ? 'pointer' : 'default',
              bgcolor: isCurrentMonth ? 'background.paper' : 'action.hover',
              border: isToday ? 2 : 0,
              borderColor: 'primary.main',
              '&:hover': {
                bgcolor: postsForDate.length > 0 ? 'action.hover' : undefined
              }
            }}
            onClick={() => handleDateClick(date)}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isToday ? 'bold' : 'normal',
                  color: isCurrentMonth ? 'text.primary' : 'text.secondary',
                  mb: 1
                }}
              >
                {date.format('D')}
              </Typography>
              
              <Stack spacing={0.5}>
                {postsForDate.slice(0, 3).map((post) => (
                  <Box
                    key={post.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      p: 0.5,
                      bgcolor: 'background.default',
                      borderRadius: 0.5,
                      fontSize: '0.75rem'
                    }}
                  >
                    {statusIcons[post.status]}
                    <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                      {dayjs(post.scheduledTime).format('HH:mm')}
                    </Typography>
                    <Stack direction="row" spacing={0.25}>
                      {post.platforms.slice(0, 2).map((platform) => (
                        <Avatar
                          key={platform}
                          sx={{
                            width: 16,
                            height: 16,
                            bgcolor: platformColors[platform],
                            '& .MuiSvgIcon-root': { fontSize: 10 }
                          }}
                        >
                          {platformIcons[platform]}
                        </Avatar>
                      ))}
                      {post.platforms.length > 2 && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                          +{post.platforms.length - 2}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ))}
                {postsForDate.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    +{postsForDate.length - 3} more
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      );
    });
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          Calendar View
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handlePreviousMonth}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
            {currentDate.format('MMMM YYYY')}
          </Typography>
          <IconButton onClick={handleNextMonth}>
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={1}>
        {/* Week day headers */}
        {weekDays.map((day) => (
          <Grid item xs key={day}>
            <Typography
              variant="subtitle2"
              sx={{
                textAlign: 'center',
                fontWeight: 'bold',
                py: 1,
                bgcolor: 'action.hover',
                borderRadius: 1
              }}
            >
              {day}
            </Typography>
          </Grid>
        ))}
        
        {/* Calendar days */}
        {renderCalendarDays()}
      </Grid>

      {/* Posts detail dialog */}
      <Dialog
        open={Boolean(selectedDate)}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Posts for {selectedDate?.format('MMMM D, YYYY')}
        </DialogTitle>
        <DialogContent>
          <List>
            {selectedDatePosts.map((post) => (
              <ListItem key={post.id} divider>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {statusIcons[post.status]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2">
                        {dayjs(post.scheduledTime).format('h:mm A')}
                      </Typography>
                      <Chip
                        label={post.status}
                        size="small"
                        color={post.status === PostStatus.PUBLISHED ? 'success' : 'default'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {post.content.length > 100 
                          ? `${post.content.substring(0, 100)}...` 
                          : post.content
                        }
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {post.platforms.map((platform) => (
                          <Avatar
                            key={platform}
                            sx={{
                              width: 20,
                              height: 20,
                              bgcolor: platformColors[platform],
                              '& .MuiSvgIcon-root': { fontSize: 12 }
                            }}
                          >
                            {platformIcons[platform]}
                          </Avatar>
                        ))}
                      </Stack>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};