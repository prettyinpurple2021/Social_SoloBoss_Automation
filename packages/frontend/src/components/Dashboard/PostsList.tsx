import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    Grid,
    Avatar,
    Stack,
    Divider,
    Alert
} from '@mui/material';
import {
    MoreVert,
    Facebook,
    Instagram,
    Pinterest,
    X as XIcon,
    Edit,
    Delete,
    Schedule,
    CheckCircle,
    Error,
    Pending
} from '@mui/icons-material';
import { Post, PostStatus } from '@sma/shared/types/post';
import { Platform } from '@sma/shared/types/platform';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PostsListProps {
    posts?: Post[];
    onEditPost?: (post: Post) => void;
    onDeletePost?: (postId: string) => void;
}

const platformIcons = {
    [Platform.FACEBOOK]: <Facebook />,
    [Platform.INSTAGRAM]: <Instagram />,
    [Platform.PINTEREST]: <Pinterest />,
    [Platform.X]: <XIcon />
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
    [PostStatus.PUBLISHING]: <Pending fontSize="small" />,
    [PostStatus.PUBLISHED]: <CheckCircle fontSize="small" />,
    [PostStatus.FAILED]: <Error fontSize="small" />
};

const statusColors = {
    [PostStatus.DRAFT]: 'default',
    [PostStatus.SCHEDULED]: 'info',
    [PostStatus.PUBLISHING]: 'warning',
    [PostStatus.PUBLISHED]: 'success',
    [PostStatus.FAILED]: 'error'
} as const;

export const PostsList: React.FC<PostsListProps> = ({
    posts,
    onEditPost,
    onDeletePost
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [mockPosts, setMockPosts] = useState<Post[]>([]);

    // Mock data for demonstration
    useEffect(() => {
        const mockData: Post[] = [
            {
                id: '1',
                userId: 'user1',
                content: 'Check out our latest blog post about social media automation! 🚀',
                images: [],
                hashtags: ['#socialmedia', '#automation', '#productivity'],
                platforms: [Platform.FACEBOOK, Platform.X],
                scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
                status: PostStatus.SCHEDULED,
                source: 'manual' as any,
                platformPosts: [
                    {
                        platform: Platform.FACEBOOK,
                        content: 'Check out our latest blog post about social media automation! 🚀',
                        status: PostStatus.SCHEDULED
                    },
                    {
                        platform: Platform.X,
                        content: 'Check out our latest blog post about social media automation! 🚀',
                        status: PostStatus.SCHEDULED
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: '2',
                userId: 'user1',
                content: 'Just published a new article on content marketing strategies.',
                images: ['https://example.com/image1.jpg'],
                hashtags: ['#contentmarketing', '#strategy'],
                platforms: [Platform.INSTAGRAM, Platform.PINTEREST],
                status: PostStatus.PUBLISHED,
                source: 'blogger' as any,
                platformPosts: [
                    {
                        platform: Platform.INSTAGRAM,
                        platformPostId: 'ig_123',
                        content: 'Just published a new article on content marketing strategies.',
                        status: PostStatus.PUBLISHED,
                        publishedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
                    },
                    {
                        platform: Platform.PINTEREST,
                        platformPostId: 'pin_456',
                        content: 'Just published a new article on content marketing strategies.',
                        status: PostStatus.PUBLISHED,
                        publishedAt: new Date(Date.now() - 25 * 60 * 1000) // 25 minutes ago
                    }
                ],
                createdAt: new Date(Date.now() - 60 * 60 * 1000),
                updatedAt: new Date(Date.now() - 30 * 60 * 1000)
            },
            {
                id: '3',
                userId: 'user1',
                content: 'Working on some exciting new features! Stay tuned...',
                images: [],
                hashtags: ['#development', '#features'],
                platforms: [Platform.X],
                status: PostStatus.FAILED,
                source: 'manual' as any,
                platformPosts: [
                    {
                        platform: Platform.X,
                        content: 'Working on some exciting new features! Stay tuned...',
                        status: PostStatus.FAILED,
                        error: 'Rate limit exceeded. Please try again later.'
                    }
                ],
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
            }
        ];
        setMockPosts(mockData);
    }, []);

    const displayPosts = posts !== undefined ? posts : mockPosts;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, post: Post) => {
        setAnchorEl(event.currentTarget);
        setSelectedPost(post);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedPost(null);
    };

    const handleEdit = () => {
        if (selectedPost && onEditPost) {
            onEditPost(selectedPost);
        }
        handleMenuClose();
    };

    const handleDelete = () => {
        if (selectedPost && onDeletePost) {
            onDeletePost(selectedPost.id);
        }
        handleMenuClose();
    };

    const formatScheduledTime = (scheduledTime?: Date) => {
        if (!scheduledTime) return null;
        return dayjs(scheduledTime).format('MMM D, YYYY at h:mm A');
    };

    const getRelativeTime = (date: Date) => {
        return dayjs(date).fromNow();
    };

    if (displayPosts.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No posts yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Create your first post to get started with social media automation
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" gutterBottom>
                Your Posts
            </Typography>

            <Grid container spacing={3}>
                {displayPosts.map((post) => (
                    <Grid item xs={12} md={6} lg={4} key={post.id}>
                        <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Chip
                                        icon={statusIcons[post.status]}
                                        label={post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                                        color={statusColors[post.status]}
                                        size="small"
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleMenuOpen(e, post)}
                                    >
                                        <MoreVert />
                                    </IconButton>
                                </Box>

                                <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.4 }}>
                                    {post.content.length > 150
                                        ? `${post.content.substring(0, 150)}...`
                                        : post.content
                                    }
                                </Typography>

                                {post.hashtags.length > 0 && (
                                    <Box sx={{ mb: 2 }}>
                                        {post.hashtags.map((hashtag, index) => (
                                            <Chip
                                                key={index}
                                                label={hashtag}
                                                size="small"
                                                variant="outlined"
                                                sx={{ mr: 0.5, mb: 0.5 }}
                                            />
                                        ))}
                                    </Box>
                                )}

                                <Divider sx={{ my: 2 }} />

                                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                    {post.platforms.map((platform) => (
                                        <Avatar
                                            key={platform}
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                bgcolor: platformColors[platform],
                                                '& .MuiSvgIcon-root': { fontSize: 18 }
                                            }}
                                        >
                                            {platformIcons[platform]}
                                        </Avatar>
                                    ))}
                                </Stack>

                                <Box>
                                    {post.status === PostStatus.SCHEDULED && post.scheduledTime && (
                                        <Typography variant="caption" color="text.secondary">
                                            Scheduled for {formatScheduledTime(post.scheduledTime)}
                                        </Typography>
                                    )}
                                    {post.status === PostStatus.PUBLISHED && (
                                        <Typography variant="caption" color="text.secondary">
                                            Published {getRelativeTime(post.updatedAt)}
                                        </Typography>
                                    )}
                                    {post.status === PostStatus.FAILED && (
                                        <Alert severity="error" sx={{ mt: 1 }}>
                                            <Typography variant="caption">
                                                {post.platformPosts.find(p => p.error)?.error || 'Publishing failed'}
                                            </Typography>
                                        </Alert>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleEdit}>
                    <Edit fontSize="small" sx={{ mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                    <Delete fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>
        </Box>
    );
};