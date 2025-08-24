import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Grid,
    Avatar,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
    Stack,
    Divider
} from '@mui/material';
import {
    Facebook,
    Instagram,
    Pinterest,
    X as XIcon,
    Add,
    Delete,
    Refresh,
    CheckCircle,
    Error,
    Warning
} from '@mui/icons-material';
import { Platform, PlatformConnection } from '@sma/shared/types/platform';
import { PLATFORM_NAMES, PLATFORM_COLORS } from '@sma/shared/constants/platforms';
import { platformsApi } from '../../services';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PlatformConnectionsProps {
    connections?: PlatformConnection[];
    onConnect?: (platform: Platform) => void;
    onDisconnect?: (connectionId: string) => void;
    onRefresh?: (connectionId: string) => void;
}

const platformIcons = {
    [Platform.FACEBOOK]: <Facebook />,
    [Platform.INSTAGRAM]: <Instagram />,
    [Platform.PINTEREST]: <Pinterest />,
    [Platform.X]: <XIcon />
};

export const PlatformConnections: React.FC<PlatformConnectionsProps> = ({
    connections,
    onConnect,
    onDisconnect,
    onRefresh
}) => {
    const [loadedConnections, setLoadedConnections] = useState<PlatformConnection[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!connections) {
            loadConnections();
        }
    }, [connections]);

    const loadConnections = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await platformsApi.getConnections();
            if (response.success && response.data) {
                setLoadedConnections(response.data);
            } else {
                setError(response.error || 'Failed to load connections');
            }
        } catch (err) {
            setError('Failed to load connections');
        } finally {
            setLoading(false);
        }
    };

    const displayConnections = connections !== undefined ? connections : loadedConnections;
    const connectedPlatforms = displayConnections.map(conn => conn.platform);
    const availablePlatforms = Object.values(Platform).filter(
        platform => !connectedPlatforms.includes(platform)
    );

    const handleConnect = async (platform: Platform) => {
        setSelectedPlatform(platform);
        setIsConnecting(true);
        setError(null);

        try {
            if (onConnect) {
                onConnect(platform);
            } else {
                const newConnection = await platformsApi.connectPlatformWithPopup(platform);
                setLoadedConnections(prev => [...prev, newConnection]);
            }
        } catch (error) {
            console.error('Connection failed:', error);
            setError(error instanceof Error ? error.message : 'Failed to connect platform');
        } finally {
            setIsConnecting(false);
            setSelectedPlatform(null);
        }
    };

    const handleDisconnect = (connectionId: string) => {
        setDisconnectDialog(connectionId);
    };

    const confirmDisconnect = async () => {
        if (disconnectDialog) {
            try {
                if (onDisconnect) {
                    onDisconnect(disconnectDialog);
                } else {
                    const response = await platformsApi.disconnectPlatform(disconnectDialog);
                    if (response.success) {
                        setLoadedConnections(prev => prev.filter(conn => conn.id !== disconnectDialog));
                    } else {
                        setError(response.error || 'Failed to disconnect platform');
                    }
                }
            } catch (err) {
                setError('Failed to disconnect platform');
            }
            setDisconnectDialog(null);
        }
    };

    const handleRefreshToken = async (connectionId: string) => {
        try {
            if (onRefresh) {
                onRefresh(connectionId);
            } else {
                const response = await platformsApi.refreshToken(connectionId);
                if (response.success && response.connection) {
                    setLoadedConnections(prev => prev.map(conn =>
                        conn.id === connectionId ? response.connection! : conn
                    ));
                } else {
                    setError(response.error || 'Failed to refresh token');
                }
            }
        } catch (err) {
            setError('Failed to refresh token');
        }
    };

    const getConnectionStatus = (connection: PlatformConnection) => {
        if (!connection.isActive) {
            return { status: 'error', message: 'Disconnected', color: 'error' as const };
        }

        if (connection.tokenExpiresAt) {
            const daysUntilExpiry = dayjs(connection.tokenExpiresAt).diff(dayjs(), 'day');
            if (daysUntilExpiry <= 0) {
                return { status: 'error', message: 'Token expired', color: 'error' as const };
            } else if (daysUntilExpiry <= 7) {
                return { status: 'warning', message: `Expires in ${daysUntilExpiry} days`, color: 'warning' as const };
            }
        }

        return { status: 'success', message: 'Connected', color: 'success' as const };
    };

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
                    Platform Connections
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Connected Platforms */}
            <Typography variant="h6" gutterBottom>
                Connected Accounts
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : displayConnections.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }}>
                    No platforms connected yet. Connect your social media accounts to start posting.
                </Alert>
            ) : (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {displayConnections.map((connection) => {
                        const status = getConnectionStatus(connection);

                        return (
                            <Grid item xs={12} md={6} lg={4} key={connection.id}>
                                <Card elevation={2}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Avatar
                                                sx={{
                                                    bgcolor: PLATFORM_COLORS[connection.platform],
                                                    mr: 2,
                                                    width: 48,
                                                    height: 48
                                                }}
                                            >
                                                {platformIcons[connection.platform]}
                                            </Avatar>
                                            <Box sx={{ flexGrow: 1 }}>
                                                <Typography variant="h6">
                                                    {PLATFORM_NAMES[connection.platform]}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {connection.platformUsername}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Chip
                                            icon={
                                                status.status === 'success' ? <CheckCircle fontSize="small" /> :
                                                    status.status === 'warning' ? <Warning fontSize="small" /> :
                                                        <Error fontSize="small" />
                                            }
                                            label={status.message}
                                            color={status.color}
                                            size="small"
                                            sx={{ mb: 2 }}
                                        />

                                        <Divider sx={{ my: 2 }} />

                                        <Stack direction="row" spacing={1}>
                                            {status.status === 'warning' || status.status === 'error' ? (
                                                <Button
                                                    size="small"
                                                    startIcon={<Refresh />}
                                                    onClick={() => handleRefreshToken(connection.id)}
                                                    color="primary"
                                                >
                                                    Refresh
                                                </Button>
                                            ) : null}
                                            <Button
                                                size="small"
                                                startIcon={<Delete />}
                                                onClick={() => handleDisconnect(connection.id)}
                                                color="error"
                                                variant="outlined"
                                            >
                                                Disconnect
                                            </Button>
                                        </Stack>

                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Connected {dayjs(connection.createdAt).fromNow()}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Available Platforms */}
            {availablePlatforms.length > 0 && (
                <>
                    <Typography variant="h6" gutterBottom>
                        Available Platforms
                    </Typography>

                    <Grid container spacing={3}>
                        {availablePlatforms.map((platform) => (
                            <Grid item xs={12} md={6} lg={4} key={platform}>
                                <Card
                                    elevation={1}
                                    sx={{
                                        border: '2px dashed',
                                        borderColor: 'divider',
                                        '&:hover': { borderColor: 'primary.main' }
                                    }}
                                >
                                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: PLATFORM_COLORS[platform],
                                                mx: 'auto',
                                                mb: 2,
                                                width: 56,
                                                height: 56
                                            }}
                                        >
                                            {platformIcons[platform]}
                                        </Avatar>

                                        <Typography variant="h6" gutterBottom>
                                            {PLATFORM_NAMES[platform]}
                                        </Typography>

                                        <Button
                                            variant="contained"
                                            startIcon={isConnecting && selectedPlatform === platform ? <CircularProgress size={16} /> : <Add />}
                                            onClick={() => handleConnect(platform)}
                                            disabled={isConnecting}
                                            sx={{ mt: 2 }}
                                        >
                                            {isConnecting && selectedPlatform === platform ? 'Connecting...' : 'Connect'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}

            {/* Disconnect Confirmation Dialog */}
            <Dialog
                open={Boolean(disconnectDialog)}
                onClose={() => setDisconnectDialog(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Disconnect Platform</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to disconnect this platform? You'll need to reconnect it to continue posting.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDisconnectDialog(null)}>Cancel</Button>
                    <Button onClick={confirmDisconnect} color="error" variant="contained">
                        Disconnect
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};