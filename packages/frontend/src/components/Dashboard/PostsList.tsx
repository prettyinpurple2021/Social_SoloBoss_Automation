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
    Alert,
    CircularProgress
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
    Pending,
    AutoAwesome
} from '@mui/icons-material';
import { Post, PostStatus } from '@sma/shared/types/post';
import { Platform } from '@sma/shared/types/platform';
import { postsApi } from '../../services';
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
    const [loadedPosts, setLoadedPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!posts) {
            loadPosts();
        }
    }, [posts]);

    const loadPosts = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await postsApi.getPosts({ limit: 20 });
            if (response.success && response.data) {
                setLoadedPosts(response.data);
            } else {
                setError(response.error || 'Failed to load posts');
            }
        } catch (err) {
            setError('Failed to load posts');
        } finally {
            setLoading(false);
        }
    };

    const displayPosts = posts !== undefined ? posts : loadedPosts;

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

    const handleDelete = async () => {
        if (selectedPost) {
            try {
                if (onDeletePost) {
                    onDeletePost(selectedPost.id);
                } else {
                    const response = await postsApi.deletePost(selectedPost.id);
                    if (response.success) {
                        setLoadedPosts(prev => prev.filter(post => post.id !== selectedPost.id));
                    } else {
                        setError(response.error || 'Failed to delete post');
                    }
                }
            } catch (err) {
                setError('Failed to delete post');
            }
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 3 }}>
                {error}
            </Alert>
        );
    }

    if (displayPosts.length === 0) {
        return (
            <Box sx={{ 
                textAlign: 'center', 
                py: 8,
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 4
            }}>
                <AutoAwesome sx={{ 
                    fontSize: '4rem',
                    mb: 2,
                    background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }} />
                <Typography 
                    variant="h4" 
                    sx={{ 
                        mb: 2,
                        fontFamily: '"Kalnia Glaze", serif',
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 500
                    }}
                >
                    No posts yet
                </Typography>
                <Typography 
                    variant="h6" 
                    sx={{ 
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontFamily: '"Kalnia Glaze", serif',
                        fontWeight: 500
                    }}
                >
                    Create your first post to get started with social media automation ✨
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography 
                variant="h3" 
                gutterBottom
                sx={{
                    fontFamily: '"Kalnia Glaze", serif',
                    background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 500,
                    mb: 3
                }}
            >
                Your Posts
            </Typography>

            <Grid container spacing={3}>
                {displayPosts.map((post) => (
                    <Grid item xs={12} md={6} lg={4} key={post.id}>
                        <Card 
                            elevation={2} 
                            sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)',
                                }
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Chip
                                        icon={statusIcons[post.status]}
                                        label={post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                                        color={statusColors[post.status]}
                                        size="small"
                                        sx={{
                                            fontFamily: '"Kalnia Glaze", serif',
                                            fontWeight: 500,
                                            borderRadius: '15px'
                                        }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleMenuOpen(e, post)}
                                        sx={{
                                            background: 'linear-gradient(45deg, rgba(240, 147, 251, 0.1), rgba(79, 172, 254, 0.1))',
                                            '&:hover': {
                                                background: 'linear-gradient(45deg, rgba(240, 147, 251, 0.2), rgba(79, 172, 254, 0.2))',
                                            }
                                        }}
                                    >
                                        <MoreVert />
                                    </IconButton>
                                </Box>

                                <Typography 
                                    variant="body1" 
                                    sx={{ 
                                        mb: 2, 
                                        lineHeight: 1.4,
                                        fontFamily: '"Kalnia Glaze", serif',
                                        fontSize: '1.1rem'
                                    }}
                                >
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
                                                sx={{ 
                                                    mr: 0.5, 
                                                    mb: 0.5,
                                                    fontFamily: '"Kalnia Glaze", serif',
                                                    fontWeight: 500,
                                                    borderRadius: '12px',
                                                    border: '1px solid',
                                                    borderImage: 'linear-gradient(45deg, #f093fb, #f5576c) 1',
                                                    '&:hover': {
                                                        background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                                                        color: 'white',
                                                    }
                                                }}
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
                                                '& .MuiSvgIcon-root': { fontSize: 18 },
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    transform: 'scale(1.1)',
                                                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
                                                }
                                            }}
                                        >
                                            {platformIcons[platform]}
                                        </Avatar>
                                    ))}
                                </Stack>

                                <Box>
                                    {post.status === PostStatus.SCHEDULED && post.scheduledTime && (
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                color: 'text.secondary',
                                                fontFamily: '"Kalnia Glaze", serif',
                                                fontWeight: 500
                                            }}
                                        >
                                            Scheduled for {formatScheduledTime(post.scheduledTime)}
                                        </Typography>
                                    )}
                                    {post.status === PostStatus.PUBLISHED && (
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                color: 'text.secondary',
                                                fontFamily: '"Kalnia Glaze", serif',
                                                fontWeight: 500
                                            }}
                                        >
                                            Published {getRelativeTime(post.updatedAt)}
                                        </Typography>
                                    )}
                                    {post.status === PostStatus.FAILED && (
                                        <Alert severity="error" sx={{ mt: 1, borderRadius: '15px' }}>
                                            <Typography 
                                                variant="caption"
                                                sx={{ fontFamily: '"Kalnia Glaze", serif', fontWeight: 500 }}
                                            >
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
                sx={{
                    '& .MuiPaper-root': {
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '15px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    }
                }}
            >
                <MenuItem onClick={handleEdit} sx={{ fontFamily: '"Kalnia Glaze", serif', fontWeight: 500 }}>
                    <Edit fontSize="small" sx={{ mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ 
                    color: 'error.main',
                    fontFamily: '"Kalnia Glaze", serif',
                    fontWeight: 500
                }}>
                    <Delete fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>
        </Box>
    );
};