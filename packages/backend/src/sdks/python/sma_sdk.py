"""
Social Media Automation Platform - Python SDK

Official Python SDK for integrating with the Social Media Automation Platform API.
Provides pythonic methods for all API endpoints with built-in error handling,
retry logic, and developer-friendly features.

Usage:
    from sma_sdk import SocialMediaAutomationSDK, SMAError
    
    # Initialize the client
    client = SocialMediaAutomationSDK(
        base_url="https://api.sma-platform.com/api",
        debug=True
    )
    
    # Login
    result = client.login("user@example.com", "password")
    user = result["user"]
    
    # Create a post
    post = client.create_post({
        "content": "Hello from Python SDK!",
        "platforms": ["facebook", "instagram"],
        "hashtags": ["#python", "#sdk"]
    })
    
    print(f"Created post: {post['id']}")
"""

import json
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, asdict
from enum import Enum

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class Platform(Enum):
    """Supported social media platforms"""
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    PINTEREST = "pinterest"
    X = "x"


class PostStatus(Enum):
    """Post status options"""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"


class PostSource(Enum):
    """Post source options"""
    MANUAL = "manual"
    BLOGGER = "blogger"
    SOLOBOSS = "soloboss"


@dataclass
class SMAConfig:
    """Configuration for the SMA SDK"""
    base_url: str = "https://api.sma-platform.com/api"
    api_key: Optional[str] = None
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 1.0
    debug: bool = False


@dataclass
class AuthTokens:
    """Authentication tokens"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None


@dataclass
class User:
    """User information"""
    id: str
    email: str
    name: str
    created_at: str
    updated_at: str


@dataclass
class PlatformPost:
    """Platform-specific post information"""
    platform: str
    platform_post_id: Optional[str]
    content: str
    status: str
    published_at: Optional[str]
    error: Optional[str]


@dataclass
class Post:
    """Post information"""
    id: str
    content: str
    images: Optional[List[str]]
    hashtags: Optional[List[str]]
    platforms: List[str]
    scheduled_time: Optional[str]
    status: str
    source: str
    platform_posts: Optional[List[PlatformPost]]
    created_at: str
    updated_at: str


@dataclass
class PlatformConnection:
    """Platform connection information"""
    id: str
    platform: str
    platform_user_id: str
    platform_username: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str


@dataclass
class Analytics:
    """Analytics data"""
    total_posts: int
    published_posts: int
    failed_posts: int
    scheduled_posts: int
    platform_breakdown: Dict[str, int]
    success_rate: float
    average_posts_per_day: float


class SMAError(Exception):
    """Custom exception for SMA SDK errors"""
    
    def __init__(
        self,
        message: str,
        code: str,
        status_code: Optional[int] = None,
        retryable: bool = False,
        retry_after: Optional[int] = None,
        request_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.retryable = retryable
        self.retry_after = retry_after
        self.request_id = request_id
        self.details = details or {}

    def __str__(self):
        return f"SMAError({self.code}): {self.message}"

    def __repr__(self):
        return (
            f"SMAError(message='{self.message}', code='{self.code}', "
            f"status_code={self.status_code}, retryable={self.retryable})"
        )


class SocialMediaAutomationSDK:
    """
    Main SDK class for Social Media Automation Platform
    
    This class provides a pythonic interface to the SMA Platform API,
    with built-in error handling, retry logic, and type hints.
    """
    
    def __init__(self, config: Optional[SMAConfig] = None):
        """
        Initialize the SDK client
        
        Args:
            config: Configuration object for the SDK
        """
        self.config = config or SMAConfig()
        self.tokens: Optional[AuthTokens] = None
        
        # Set up requests session with retry strategy
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=self.config.retry_attempts,
            backoff_factor=self.config.retry_delay,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "PUT", "DELETE"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "SMA-SDK-Python/1.0.0",
            "X-SDK-Version": "1.0.0"
        })

    def _generate_request_id(self) -> str:
        """Generate a unique request ID"""
        return f"sdk_{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """
        Make an HTTP request to the API
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            retry_count: Current retry attempt
            
        Returns:
            API response data
            
        Raises:
            SMAError: If the request fails
        """
        url = f"{self.config.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        
        # Prepare headers
        headers = {
            "X-Request-ID": self._generate_request_id()
        }
        
        # Add authentication
        if self.tokens and self.tokens.access_token:
            headers["Authorization"] = f"Bearer {self.tokens.access_token}"
        elif self.config.api_key:
            headers["X-API-Key"] = self.config.api_key

        # Debug logging
        if self.config.debug:
            print(f"SMA SDK Request: {method} {url}")
            if data:
                print(f"Request Data: {json.dumps(data, indent=2)}")
            if params:
                print(f"Request Params: {params}")

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers,
                timeout=self.config.timeout
            )
            
            if self.config.debug:
                print(f"SMA SDK Response: {response.status_code}")
                print(f"Response Data: {response.text}")

            # Handle token expiration
            if response.status_code == 401 and self.tokens and self.tokens.refresh_token:
                try:
                    self.refresh_token()
                    # Retry the original request
                    headers["Authorization"] = f"Bearer {self.tokens.access_token}"
                    response = self.session.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params,
                        headers=headers,
                        timeout=self.config.timeout
                    )
                except Exception:
                    # Refresh failed, clear tokens
                    self.tokens = None

            # Parse response
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                response_data = {"success": False, "error": {"message": response.text}}

            # Handle API errors
            if not response.ok:
                error_data = response_data.get("error", {})
                raise SMAError(
                    message=error_data.get("message", f"HTTP {response.status_code}"),
                    code=error_data.get("code", "HTTP_ERROR"),
                    status_code=response.status_code,
                    retryable=error_data.get("retryable", False),
                    retry_after=error_data.get("retryAfter"),
                    request_id=error_data.get("requestId"),
                    details=error_data.get("details")
                )

            return response_data

        except requests.exceptions.RequestException as e:
            # Handle network errors with retry logic
            if retry_count < self.config.retry_attempts:
                delay = self.config.retry_delay * (2 ** retry_count)
                if self.config.debug:
                    print(f"Request failed, retrying in {delay}s... (attempt {retry_count + 1})")
                time.sleep(delay)
                return self._make_request(method, endpoint, data, params, retry_count + 1)
            
            raise SMAError(
                message=f"Network error: {str(e)}",
                code="NETWORK_ERROR",
                retryable=True
            )

    # Authentication methods
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Login with email and password
        
        Args:
            email: User email address
            password: User password
            
        Returns:
            Dictionary containing user info and tokens
            
        Raises:
            SMAError: If login fails
        """
        response = self._make_request("POST", "/auth/login", {
            "email": email,
            "password": password
        })
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Login failed", "LOGIN_FAILED")
        
        data = response["data"]
        self.tokens = AuthTokens(
            access_token=data["token"],
            refresh_token=data.get("refreshToken"),
            expires_at=datetime.now() + timedelta(minutes=15)
        )
        
        return {
            "user": User(**data["user"]),
            "tokens": self.tokens
        }

    def register(self, email: str, password: str, name: str) -> Dict[str, Any]:
        """
        Register a new user
        
        Args:
            email: User email address
            password: User password
            name: User full name
            
        Returns:
            Dictionary containing user info and tokens
            
        Raises:
            SMAError: If registration fails
        """
        response = self._make_request("POST", "/auth/register", {
            "email": email,
            "password": password,
            "name": name
        })
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Registration failed", "REGISTRATION_FAILED")
        
        data = response["data"]
        self.tokens = AuthTokens(
            access_token=data["token"],
            refresh_token=data.get("refreshToken"),
            expires_at=datetime.now() + timedelta(minutes=15)
        )
        
        return {
            "user": User(**data["user"]),
            "tokens": self.tokens
        }

    def refresh_token(self) -> AuthTokens:
        """
        Refresh the access token
        
        Returns:
            Updated tokens
            
        Raises:
            SMAError: If refresh fails
        """
        if not self.tokens or not self.tokens.refresh_token:
            raise SMAError("No refresh token available", "NO_REFRESH_TOKEN")
        
        response = self._make_request("POST", "/auth/refresh", {
            "refreshToken": self.tokens.refresh_token
        })
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Token refresh failed", "TOKEN_REFRESH_FAILED")
        
        self.tokens.access_token = response["data"]["token"]
        self.tokens.expires_at = datetime.now() + timedelta(minutes=15)
        
        return self.tokens

    def set_tokens(self, tokens: AuthTokens) -> None:
        """Set authentication tokens manually"""
        self.tokens = tokens

    def logout(self) -> None:
        """Logout and clear tokens"""
        try:
            self._make_request("POST", "/auth/logout")
        finally:
            self.tokens = None

    # Posts methods
    def get_posts(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        platform: Optional[str] = None,
        sort: str = "createdAt",
        order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Get posts with optional filtering
        
        Args:
            page: Page number (default: 1)
            limit: Items per page (default: 20)
            status: Filter by post status
            platform: Filter by platform
            sort: Sort field (default: "createdAt")
            order: Sort order (default: "desc")
            
        Returns:
            Paginated response with posts
        """
        params = {
            "page": page,
            "limit": limit,
            "sort": sort,
            "order": order
        }
        
        if status:
            params["status"] = status
        if platform:
            params["platform"] = platform
        
        response = self._make_request("GET", "/posts", params=params)
        
        if not response.get("success"):
            raise SMAError("Failed to get posts", "POSTS_FETCH_FAILED")
        
        return response

    def get_post(self, post_id: str) -> Post:
        """
        Get a specific post by ID
        
        Args:
            post_id: Post ID
            
        Returns:
            Post object
            
        Raises:
            SMAError: If post not found
        """
        response = self._make_request("GET", f"/posts/{post_id}")
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Post not found", "POST_NOT_FOUND")
        
        return Post(**response["data"])

    def create_post(self, post_data: Dict[str, Any]) -> Post:
        """
        Create a new post
        
        Args:
            post_data: Post creation data
            
        Returns:
            Created post object
            
        Raises:
            SMAError: If creation fails
        """
        response = self._make_request("POST", "/posts", post_data)
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to create post", "POST_CREATION_FAILED")
        
        return Post(**response["data"])

    def update_post(self, post_id: str, post_data: Dict[str, Any]) -> Post:
        """
        Update an existing post
        
        Args:
            post_id: Post ID
            post_data: Updated post data
            
        Returns:
            Updated post object
            
        Raises:
            SMAError: If update fails
        """
        response = self._make_request("PUT", f"/posts/{post_id}", post_data)
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to update post", "POST_UPDATE_FAILED")
        
        return Post(**response["data"])

    def delete_post(self, post_id: str) -> None:
        """
        Delete a post
        
        Args:
            post_id: Post ID
            
        Raises:
            SMAError: If deletion fails
        """
        response = self._make_request("DELETE", f"/posts/{post_id}")
        
        if not response.get("success"):
            raise SMAError("Failed to delete post", "POST_DELETION_FAILED")

    def publish_post(self, post_id: str) -> Dict[str, Any]:
        """
        Publish a post immediately
        
        Args:
            post_id: Post ID
            
        Returns:
            Publishing results
            
        Raises:
            SMAError: If publishing fails
        """
        response = self._make_request("POST", f"/posts/{post_id}/publish")
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to publish post", "POST_PUBLISH_FAILED")
        
        return response["data"]

    def create_bulk_posts(self, posts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create multiple posts in bulk
        
        Args:
            posts: List of post creation data
            
        Returns:
            Bulk creation results
            
        Raises:
            SMAError: If bulk creation fails
        """
        response = self._make_request("POST", "/posts/bulk", {"posts": posts})
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to create bulk posts", "BULK_POST_CREATION_FAILED")
        
        return response["data"]

    # Analytics methods
    def get_analytics(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        platform: Optional[str] = None
    ) -> Analytics:
        """
        Get post analytics
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            platform: Filter by platform
            
        Returns:
            Analytics object
            
        Raises:
            SMAError: If analytics fetch fails
        """
        params = {}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if platform:
            params["platform"] = platform
        
        response = self._make_request("GET", "/posts/analytics", params=params)
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to get analytics", "ANALYTICS_FETCH_FAILED")
        
        return Analytics(**response["data"])

    # Platform connection methods
    def connect_platform(self, platform: str, auth_code: str, redirect_uri: str) -> PlatformConnection:
        """
        Connect to a social media platform
        
        Args:
            platform: Platform name
            auth_code: OAuth authorization code
            redirect_uri: OAuth redirect URI
            
        Returns:
            Platform connection object
            
        Raises:
            SMAError: If connection fails
        """
        response = self._make_request("POST", f"/oauth/connect/{platform}", {
            "code": auth_code,
            "redirectUri": redirect_uri
        })
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to connect platform", "PLATFORM_CONNECTION_FAILED")
        
        return PlatformConnection(**response["data"]["platformConnection"])

    def disconnect_platform(self, platform: str) -> None:
        """
        Disconnect from a social media platform
        
        Args:
            platform: Platform name
            
        Raises:
            SMAError: If disconnection fails
        """
        response = self._make_request("DELETE", f"/oauth/disconnect/{platform}")
        
        if not response.get("success"):
            raise SMAError("Failed to disconnect platform", "PLATFORM_DISCONNECTION_FAILED")

    # Utility methods
    def check_health(self) -> Dict[str, Any]:
        """
        Check API health
        
        Returns:
            Health status information
            
        Raises:
            SMAError: If health check fails
        """
        response = self._make_request("GET", "/health")
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Health check failed", "HEALTH_CHECK_FAILED")
        
        return response["data"]

    def get_current_user(self) -> User:
        """
        Get current user information
        
        Returns:
            User object
            
        Raises:
            SMAError: If user info fetch fails
        """
        response = self._make_request("GET", "/auth/me")
        
        if not response.get("success") or not response.get("data"):
            raise SMAError("Failed to get user info", "USER_INFO_FAILED")
        
        return User(**response["data"])


# Convenience function to create SDK instance
def create_sma_client(config: Optional[SMAConfig] = None) -> SocialMediaAutomationSDK:
    """
    Create a new SMA SDK client instance
    
    Args:
        config: Optional configuration object
        
    Returns:
        SMA SDK client instance
    """
    return SocialMediaAutomationSDK(config)


# Export main classes and functions
__all__ = [
    "SocialMediaAutomationSDK",
    "SMAConfig",
    "SMAError",
    "AuthTokens",
    "User",
    "Post",
    "PlatformPost",
    "PlatformConnection",
    "Analytics",
    "Platform",
    "PostStatus",
    "PostSource",
    "create_sma_client"
]