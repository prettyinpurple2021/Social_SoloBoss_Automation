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
    connections = [],
    onConnect,
    onDisconnect,
    onRefresh
}) => {
    const [mockConnections, setMockConnections] = useState<PlatformConnection[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null);

    // Mock data for demonstration
    useEffect(() => {
        const mockData: PlatformConnection[] = [
            {
                id: '1',
                userId: 'user1',
                platform: Platform.FACEBOOK,
                platformUserId: 'fb_123456',
                platformUsername: 'My Business Page',
                accessToken: 'encrypted_token_1',
                tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                isActive: true,
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                updatedAt: new Date()
            },
            {
                id: '2',
                userId: 'user1',
                platform: Platform.INSTAGRAM,
                platformUserId: 'ig_789012',
                platformUsername: '@mybusiness',
                accessToken: 'encrypted_token_2',
                tokenExpiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
                isActive: true,
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
                updatedAt: new Date()
            },
            {
                id: '3',
                userId: 'user1',
                platform: Platform.X,
                platformUserId: 'x_345678',
                platformUsername: '@mybusiness',
                accessToken: 'encrypted_token_3',
                tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now (expiring soon)
                isActive: true,
                createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
                updatedAt: new Date()
            }
        ];
        setMockConnections(mockData);
    }, []);

    const displayConnections = connections.length > 0 ? connections : mockConnections;
    const connectedPlatforms = displayConnections.map(conn => conn.platform);
    const availablePlatforms = Object.values(Platform).filter(
        platform => !connectedPlatforms.includes(platform)
    );

    const handleConnect = async (platform: Platform) => {
        setSelectedPlatform(platform);
        setIsConnecting(true);

        try {
            // Simulate OAuth flow
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (onConnect) {
                onConnect(platform);
            }

            // Mock successful connection
            const newConnection: PlatformConnection = {
                id: `mock_${Date.now()}`,
                userId: 'user1',
                platform,
                platformUserId: `${platform}_${Date.now()}`,
                platformUsername: `@user_${platform}`,
                accessToken: 'encrypted_token_new',
                tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            setMockConnections(prev => [...prev, newConnection]);
        } catch (error) {
            console.error('Connection failed:', error);
        } finally {
            setIsConnecting(false);
            setSelectedPlatform(null);
        }
    };

    const handleDisconnect = (connectionId: string) => {
        setDisconnectDialog(connectionId);
    };

    const confirmDisconnect = () => {
        if (disconnectDialog) {
            if (onDisconnect) {
                onDisconnect(disconnectDialog);
            }

            // Mock disconnection
            setMockConnections(prev => prev.filter(conn => conn.id !== disconnectDialog));
            setDisconnectDialog(null);
        }
    };

    const handleRefreshToken = async (connectionId: string) => {
        if (onRefresh) {
            onRefresh(connectionId);
        }

        // Mock token refresh
        setMockConnections(prev => prev.map(conn =>
            conn.id === connectionId
                ? { ...conn, tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), updatedAt: new Date() }
                : conn
        ));
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
                <Typography variant="h5">
                    Platform Connections
                </Typography>
            </Box>

            {/* Connected Platforms */}
            <Typography variant="h6" gutterBottom>
                Connected Accounts
            </Typography>

            {displayConnections.length === 0 ? (
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