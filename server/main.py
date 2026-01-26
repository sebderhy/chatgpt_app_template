"""
ChatGPT App Boilerplate - Python MCP Server

This server provides multiple widget templates:
- Boilerplate: Basic interactive widget
- Carousel: Horizontal scrolling cards
- List: Vertical list with thumbnails
- Gallery: Image grid with lightbox
- Dashboard: Stats and metrics display
- Solar System: Interactive 3D solar system
- Todo: Multi-list todo manager
- Shop: E-commerce cart with checkout

Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field, ValidationError


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass(frozen=True)
class Widget:
    """Configuration for a widget that can be rendered in ChatGPT."""
    identifier: str
    title: str
    description: str
    template_uri: str
    invoking: str
    invoked: str
    html: str


ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
MIME_TYPE = "text/html+skybridge"


# =============================================================================
# WIDGET HTML LOADING
# =============================================================================

_DEFAULT_BASE_URL = "http://localhost:8000/assets"

# Cache for loaded HTML with resolved URLs (keyed by component name)
_html_cache: Dict[str, str] = {}


def _clear_html_cache() -> None:
    """Clear the HTML cache. Used by tests."""
    _html_cache.clear()


def get_base_url() -> str:
    """Get the base URL for assets from environment or use default."""
    return os.environ.get("BASE_URL", _DEFAULT_BASE_URL).rstrip("/")


def load_widget_html(component_name: str) -> str:
    """Load the built widget HTML from the assets directory.

    Converts relative paths (./) to absolute URLs using BASE_URL env var.
    This is needed because widget HTML is injected into iframes via srcdoc,
    where relative paths don't resolve correctly.

    Results are cached per component name.
    """
    if component_name in _html_cache:
        return _html_cache[component_name]

    html_path = ASSETS_DIR / f"{component_name}.html"
    if html_path.exists():
        html = html_path.read_text(encoding="utf8")
    else:
        fallback_candidates = sorted(ASSETS_DIR.glob(f"{component_name}-*.html"))
        if fallback_candidates:
            html = fallback_candidates[-1].read_text(encoding="utf8")
        else:
            raise FileNotFoundError(
                f'Widget HTML for "{component_name}" not found in {ASSETS_DIR}. '
                "Run `pnpm run build` from the repo root to generate the assets."
            )

    # Convert relative paths to absolute URLs for srcdoc iframe compatibility
    # HTML files use "./" prefix which works for static serving but not srcdoc
    base_url = get_base_url()
    html = html.replace('src="./', f'src="{base_url}/')
    html = html.replace('href="./', f'href="{base_url}/')

    _html_cache[component_name] = html
    return html


# Add cache_clear method for test compatibility (mimics lru_cache interface)
load_widget_html.cache_clear = _clear_html_cache  # type: ignore[attr-defined]


# =============================================================================
# WIDGET DEFINITIONS
# =============================================================================

def create_widgets() -> List[Widget]:
    """Create all widget configurations."""
    return [
        Widget(
            identifier="show_card",
            title="Show Card Widget",
            description="""Display an interactive card widget with items.

Use this tool when:
- The user wants a simple, clean display of a few items
- You need a basic interactive widget that doesn't fit other categories
- Displaying a single entity with details and actions

Args:
    title: Widget header text (default: "Card Widget")
    message: Main message displayed in the card (default: "Hello from the server!")
    accentColor: Hex color for accent styling (default: "#2563eb")

Returns:
    Interactive card with title, message, accent color, and sample items list.

Example:
    show_card(title="Welcome", message="Click items below", accentColor="#10b981")""",
            template_uri="ui://widget/boilerplate.html",
            invoking="Loading card widget...",
            invoked="Card widget ready",
            html=load_widget_html("boilerplate"),
        ),
        Widget(
            identifier="show_carousel",
            title="Show Carousel",
            description="""Display a horizontal carousel of cards for browsing multiple items.

Use this tool when:
- The user asks for recommendations (restaurants, hotels, products)
- Showing a collection where users want to browse horizontally
- Displaying options with images, ratings, and quick info

Args:
    title: Carousel header text (default: "Recommendations")
    category: Category of items to display (default: "restaurants")

Returns:
    Horizontal scrolling carousel with cards containing:
    - Image thumbnail
    - Title and subtitle
    - Rating (1-5 stars)
    - Location and price level
    - Optional badge (e.g., "Popular", "New")

Example:
    show_carousel(title="Top Restaurants Near You", category="restaurants")""",
            template_uri="ui://widget/carousel.html",
            invoking="Loading carousel...",
            invoked="Carousel ready",
            html=load_widget_html("carousel"),
        ),
        Widget(
            identifier="show_list",
            title="Show List",
            description="""Display a vertical list with thumbnails and metadata.

Use this tool when:
- The user wants ranked/ordered content (top 10, best of, search results)
- Showing items where order and comparison matter
- Displaying task lists or sequential items

Args:
    title: List header text (default: "Top Picks")
    subtitle: Secondary header text (default: "Curated recommendations")
    category: Category of items to display (default: "restaurants")

Returns:
    Vertical scrolling list with items containing:
    - Thumbnail image
    - Title and subtitle
    - Rating
    - Metadata (location, etc.)
    - Optional rank badge (#1, #2, etc.)

Example:
    show_list(title="Top 5 Coffee Shops", subtitle="Based on reviews", category="cafes")""",
            template_uri="ui://widget/list.html",
            invoking="Loading list...",
            invoked="List ready",
            html=load_widget_html("list"),
        ),
        Widget(
            identifier="show_gallery",
            title="Show Gallery",
            description="""Display an image gallery with grid layout and lightbox viewer.

Use this tool when:
- The user wants to see photos or images
- Displaying visual portfolios, albums, or collections
- Images are the primary content (not just thumbnails)

Args:
    title: Gallery header text (default: "Photo Gallery")
    category: Category of images to display (default: "nature")

Returns:
    Image grid with lightbox functionality containing:
    - Thumbnail grid view
    - Full-size lightbox on click
    - Image title and description
    - Author attribution

Example:
    show_gallery(title="Nature Photography", category="nature")""",
            template_uri="ui://widget/gallery.html",
            invoking="Loading gallery...",
            invoked="Gallery ready",
            html=load_widget_html("gallery"),
        ),
        Widget(
            identifier="show_dashboard",
            title="Show Dashboard",
            description="""Display a dashboard with stats, metrics, and activity feed.

Use this tool when:
- The user wants to see analytics or KPIs
- Showing account overview or status information
- Displaying numerical data with trends

Args:
    title: Dashboard header text (default: "Dashboard")
    period: Time period label (default: "Last 30 days")

Returns:
    Dashboard layout with:
    - Stat cards (value, change percentage, icon)
    - Activity feed (recent events with timestamps)
    - Period selector display

Example:
    show_dashboard(title="Sales Overview", period="This month")""",
            template_uri="ui://widget/dashboard.html",
            invoking="Loading dashboard...",
            invoked="Dashboard ready",
            html=load_widget_html("dashboard"),
        ),
        Widget(
            identifier="show_solar_system",
            title="Show Solar System",
            description="""Display an interactive 3D solar system visualization.

Use this tool when:
- The user asks about planets, astronomy, or the solar system
- Educational content about space
- Interactive learning experiences

Args:
    title: Widget header text (default: "Solar System Explorer")
    planet_name: Optional planet to focus on (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)

Returns:
    Interactive 3D visualization with:
    - Animated planet orbits
    - Clickable planets with info panels
    - Planet details (size, distance, facts)

Example:
    show_solar_system(title="Explore the Planets", planet_name="Mars")""",
            template_uri="ui://widget/solar-system.html",
            invoking="Loading solar system...",
            invoked="Solar system ready",
            html=load_widget_html("solar-system"),
        ),
        Widget(
            identifier="show_todo",
            title="Show Todo List",
            description="""Display an interactive todo list manager with multiple lists.

Use this tool when:
- The user wants to organize tasks or create a todo list
- Managing multiple lists (work, personal, shopping)
- Tracking task completion and due dates

Args:
    title: Main title text (default: "My Tasks")

Returns:
    Todo manager interface with:
    - Multiple collapsible lists
    - Drag-and-drop reordering
    - Task completion checkboxes
    - Due date display
    - Add/edit/delete functionality

Example:
    show_todo(title="Today's Tasks")""",
            template_uri="ui://widget/todo.html",
            invoking="Loading todo list...",
            invoked="Todo list ready",
            html=load_widget_html("todo"),
        ),
        Widget(
            identifier="show_shop",
            title="Show Shopping Cart",
            description="""Display a shopping cart with products and checkout flow.

Use this tool when:
- The user wants to manage a shopping cart
- E-commerce checkout experiences
- Product quantity and price management

Args:
    title: Cart header text (default: "Your Cart")

Returns:
    Shopping cart interface with:
    - Product list with images and descriptions
    - Quantity controls (+/-)
    - Price calculations
    - Product tags (vegan, spicy, etc.)
    - Checkout button

Example:
    show_shop(title="Your Shopping Cart")""",
            template_uri="ui://widget/shop.html",
            invoking="Loading shopping cart...",
            invoked="Shopping cart ready",
            html=load_widget_html("shop"),
        ),
        Widget(
            identifier="show_travel_map",
            title="Show Travel Map",
            description="""Display an interactive map with places of interest - TripAdvisor style.

Use this tool when:
- The user asks about places to visit in a city or area
- Showing hotels, restaurants, attractions on a map
- Travel planning and destination exploration
- Displaying multiple points of interest with locations

Args:
    title: Map header text (default: "Explore the Area")
    subtitle: Secondary text (default: "Top-rated places near you")
    location: City or area name (default: "San Francisco")

Returns:
    Interactive map widget with:
    - Color-coded markers for different categories (restaurants, hotels, attractions, cafes, shops)
    - Clickable markers showing place details
    - Place cards with ratings, reviews, price levels
    - Horizontal scrollable list of all places
    - Category legend

Example:
    show_travel_map(title="Top Places in Paris", subtitle="Must-visit spots", location="Paris")""",
            template_uri="ui://widget/travel-map.html",
            invoking="Loading travel map...",
            invoked="Travel map ready",
            html=load_widget_html("travel-map"),
        ),
    ]


# Initialize widgets (lazy loading to handle missing assets gracefully)
try:
    WIDGETS = create_widgets()
except FileNotFoundError as e:
    print(f"Warning: {e}")
    print("Some widgets may not be available. Run `pnpm run build` first.")
    WIDGETS = []

WIDGETS_BY_ID: Dict[str, Widget] = {w.identifier: w for w in WIDGETS}
WIDGETS_BY_URI: Dict[str, Widget] = {w.template_uri: w for w in WIDGETS}


# =============================================================================
# INPUT SCHEMAS
# =============================================================================

class CardInput(BaseModel):
    """Input for card widget."""
    title: str = Field(default="Card Widget", description="Widget title")
    message: str = Field(default="Hello from the server!", description="Main message")
    accent_color: str = Field(default="#2563eb", alias="accentColor", description="Accent color (hex)")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class CarouselInput(BaseModel):
    """Input for carousel widget."""
    title: str = Field(default="Recommendations", description="Carousel title")
    category: str = Field(default="restaurants", description="Category of items to show")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ListInput(BaseModel):
    """Input for list widget."""
    title: str = Field(default="Top Picks", description="List title")
    subtitle: str = Field(default="Curated recommendations", description="List subtitle")
    category: str = Field(default="restaurants", description="Category of items")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class GalleryInput(BaseModel):
    """Input for gallery widget."""
    title: str = Field(default="Photo Gallery", description="Gallery title")
    category: str = Field(default="nature", description="Category of images")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class DashboardInput(BaseModel):
    """Input for dashboard widget."""
    title: str = Field(default="Dashboard", description="Dashboard title")
    period: str = Field(default="Last 30 days", description="Time period")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class SolarSystemInput(BaseModel):
    """Input for solar system widget."""
    planet_name: Optional[str] = Field(default=None, description="Planet to focus on (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)")
    title: str = Field(default="Solar System Explorer", description="Widget title")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class TodoInput(BaseModel):
    """Input for todo widget."""
    title: str = Field(default="My Tasks", description="Main title")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ShopInput(BaseModel):
    """Input for shop widget."""
    title: str = Field(default="Your Cart", description="Cart title")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class TravelMapInput(BaseModel):
    """Input for travel map widget."""
    title: str = Field(default="Explore the Area", description="Map title")
    subtitle: str = Field(default="Top-rated places near you", description="Map subtitle")
    location: str = Field(default="San Francisco", description="City or area to display")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


# =============================================================================
# SAMPLE DATA
# =============================================================================

SAMPLE_CAROUSEL_ITEMS = [
    {"id": "1", "title": "Golden Gate Bistro", "subtitle": "Modern American", "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop", "rating": 4.8, "location": "San Francisco", "price": "$$$", "badge": "Popular"},
    {"id": "2", "title": "Marina Bay Kitchen", "subtitle": "Fresh seafood", "image": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&h=300&fit=crop", "rating": 4.6, "location": "Oakland", "price": "$$"},
    {"id": "3", "title": "Sunset Terrace", "subtitle": "Rooftop dining", "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop", "rating": 4.9, "location": "Berkeley", "price": "$$$$", "badge": "New"},
    {"id": "4", "title": "The Local Table", "subtitle": "Farm-to-table", "image": "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&h=300&fit=crop", "rating": 4.5, "location": "Palo Alto", "price": "$$"},
    {"id": "5", "title": "Urban Spice", "subtitle": "Indian fusion", "image": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop", "rating": 4.7, "location": "San Jose", "price": "$$"},
]

SAMPLE_LIST_ITEMS = [
    {"id": "1", "title": "The Modern Kitchen", "subtitle": "Contemporary American", "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop", "rating": 4.9, "meta": "San Francisco", "badge": "#1"},
    {"id": "2", "title": "Bella Italia", "subtitle": "Authentic Italian", "image": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&h=100&fit=crop", "rating": 4.8, "meta": "Oakland", "badge": "#2"},
    {"id": "3", "title": "Sakura Japanese", "subtitle": "Sushi & Izakaya", "image": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=100&h=100&fit=crop", "rating": 4.7, "meta": "Berkeley", "badge": "#3"},
    {"id": "4", "title": "Taco Loco", "subtitle": "Mexican Street Food", "image": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=100&h=100&fit=crop", "rating": 4.6, "meta": "San Jose"},
    {"id": "5", "title": "Golden Dragon", "subtitle": "Cantonese Cuisine", "image": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=100&h=100&fit=crop", "rating": 4.5, "meta": "Palo Alto"},
]

SAMPLE_GALLERY_IMAGES = [
    {"id": "1", "src": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop", "title": "Mountain Sunrise", "description": "Alps at dawn", "author": "John Doe"},
    {"id": "2", "src": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop", "title": "Forest Path", "description": "Sunlit forest", "author": "Jane Smith"},
    {"id": "3", "src": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop", "title": "Tropical Beach", "description": "Crystal waters", "author": "Mike Johnson"},
    {"id": "4", "src": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop", "title": "Starry Night", "description": "Milky Way", "author": "Sarah Wilson"},
    {"id": "5", "src": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop", "title": "Ocean Waves", "description": "Crashing waves", "author": "Tom Brown"},
    {"id": "6", "src": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop", "thumbnail": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop", "title": "Misty Forest", "description": "Morning fog", "author": "Emily Davis"},
]

SAMPLE_DASHBOARD_STATS = [
    {"id": "revenue", "label": "Total Revenue", "value": "$45,231.89", "change": 20.1, "changeLabel": "from last month", "icon": "dollar"},
    {"id": "users", "label": "Active Users", "value": "2,350", "change": 15.3, "changeLabel": "from last month", "icon": "users"},
    {"id": "orders", "label": "Orders", "value": "1,247", "change": -5.2, "changeLabel": "from last month", "icon": "cart"},
    {"id": "views", "label": "Page Views", "value": "573,921", "change": 12.5, "changeLabel": "from last month", "icon": "eye"},
]

SAMPLE_ACTIVITIES = [
    {"id": "1", "title": "New user registered", "description": "john.doe@example.com signed up", "time": "2 min ago", "type": "success"},
    {"id": "2", "title": "Order completed", "description": "Order #12345 fulfilled", "time": "15 min ago", "type": "info"},
    {"id": "3", "title": "Payment failed", "description": "$99.00 declined", "time": "1 hour ago", "type": "error"},
    {"id": "4", "title": "Low stock alert", "description": "SKU-789 running low", "time": "3 hours ago", "type": "warning"},
]

SAMPLE_TODO_LISTS = [
    {
        "id": "work",
        "title": "Work Tasks",
        "isCurrentlyOpen": True,
        "todos": [
            {"id": "1", "title": "Review pull requests", "isComplete": False, "note": "Check the new feature branch"},
            {"id": "2", "title": "Update documentation", "isComplete": True},
            {"id": "3", "title": "Team standup meeting", "isComplete": False, "dueDate": "2025-01-15"},
        ],
    },
    {
        "id": "personal",
        "title": "Personal",
        "todos": [
            {"id": "4", "title": "Buy groceries", "isComplete": False},
            {"id": "5", "title": "Call mom", "isComplete": False, "dueDate": "2025-01-14"},
        ],
    },
    {
        "id": "shopping",
        "title": "Shopping List",
        "todos": [
            {"id": "6", "title": "Milk", "isComplete": False},
            {"id": "7", "title": "Bread", "isComplete": True},
            {"id": "8", "title": "Eggs", "isComplete": False},
        ],
    },
]

SAMPLE_CART_ITEMS = [
    {
        "id": "marys-chicken",
        "name": "Mary's Chicken",
        "price": 19.48,
        "description": "Tender organic chicken breasts trimmed for easy cooking.",
        "shortDescription": "Organic chicken breasts",
        "detailSummary": "4 lbs - $3.99/lb",
        "quantity": 2,
        "image": "https://persistent.oaistatic.com/pizzaz-cart-xl/chicken.png",
        "tags": ["size"],
    },
    {
        "id": "avocados",
        "name": "Avocados",
        "price": 1.00,
        "description": "Creamy Hass avocados picked at peak ripeness.",
        "shortDescription": "Creamy Hass avocados",
        "quantity": 2,
        "image": "https://persistent.oaistatic.com/pizzaz-cart-xl/avocado.png",
        "tags": ["vegan"],
    },
    {
        "id": "hojicha-pizza",
        "name": "Hojicha Pizza",
        "price": 15.50,
        "description": "Wood-fired crust with smoky hojicha tea sauce and honey.",
        "shortDescription": "Smoky hojicha sauce & honey",
        "quantity": 1,
        "image": "https://persistent.oaistatic.com/pizzaz-cart-xl/hojicha-pizza.png",
        "tags": ["vegetarian", "spicy"],
    },
    {
        "id": "chicken-pizza",
        "name": "Chicken Pizza",
        "price": 7.00,
        "description": "Classic thin-crust pizza with roasted chicken and herb pesto.",
        "shortDescription": "Roasted chicken & pesto",
        "quantity": 1,
        "image": "https://persistent.oaistatic.com/pizzaz-cart-xl/chicken-pizza.png",
        "tags": [],
    },
    {
        "id": "matcha-pizza",
        "name": "Matcha Pizza",
        "price": 5.00,
        "description": "Crisp dough with velvety matcha cream and mascarpone.",
        "shortDescription": "Velvety matcha cream",
        "quantity": 1,
        "image": "https://persistent.oaistatic.com/pizzaz-cart-xl/matcha-pizza.png",
        "tags": ["vegetarian"],
    },
]

SAMPLE_MAP_PLACES = [
    {
        "id": "1",
        "name": "Golden Gate Bistro",
        "category": "restaurant",
        "description": "Award-winning modern American cuisine with stunning bay views",
        "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
        "rating": 4.8,
        "reviewCount": 2847,
        "priceLevel": "$$$",
        "address": "123 Marina Blvd, San Francisco",
        "lat": 37.8024,
        "lng": -122.4058,
        "tags": ["Fine Dining", "Waterfront"],
    },
    {
        "id": "2",
        "name": "The Fairmont",
        "category": "hotel",
        "description": "Historic luxury hotel atop Nob Hill with panoramic city views",
        "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop",
        "rating": 4.7,
        "reviewCount": 5234,
        "priceLevel": "$$$$",
        "address": "950 Mason St, San Francisco",
        "lat": 37.7922,
        "lng": -122.4100,
        "tags": ["Luxury", "Historic"],
    },
    {
        "id": "3",
        "name": "Alcatraz Island",
        "category": "attraction",
        "description": "Iconic former federal prison with guided tours and bay views",
        "image": "https://images.unsplash.com/photo-1534050359320-02900022671e?w=400&h=300&fit=crop",
        "rating": 4.9,
        "reviewCount": 18432,
        "address": "Alcatraz Island, San Francisco Bay",
        "lat": 37.8267,
        "lng": -122.4230,
        "tags": ["Historic", "Must See"],
    },
    {
        "id": "4",
        "name": "Blue Bottle Coffee",
        "category": "cafe",
        "description": "Artisan coffee roasters known for pour-over and espresso",
        "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop",
        "rating": 4.5,
        "reviewCount": 1256,
        "priceLevel": "$$",
        "address": "66 Mint St, San Francisco",
        "lat": 37.7825,
        "lng": -122.4024,
        "tags": ["Local Favorite"],
    },
    {
        "id": "5",
        "name": "Ferry Building Marketplace",
        "category": "shop",
        "description": "Historic waterfront marketplace with local artisan vendors",
        "image": "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=300&fit=crop",
        "rating": 4.6,
        "reviewCount": 8921,
        "address": "1 Ferry Building, San Francisco",
        "lat": 37.7956,
        "lng": -122.3935,
        "tags": ["Shopping", "Food Hall"],
    },
    {
        "id": "6",
        "name": "Fisherman's Wharf",
        "category": "attraction",
        "description": "Bustling waterfront neighborhood with seafood and sea lions",
        "image": "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&h=300&fit=crop",
        "rating": 4.4,
        "reviewCount": 12543,
        "address": "Jefferson St, San Francisco",
        "lat": 37.8080,
        "lng": -122.4177,
        "tags": ["Family Friendly", "Iconic"],
    },
]


# =============================================================================
# MCP SERVER SETUP
# =============================================================================

SERVER_INSTRUCTIONS = """
## ChatGPT Widget Server Usage Guide

This MCP server provides interactive widget tools for ChatGPT. Each tool displays
a specific type of visual content in the chat interface.

### Tool Selection Guide

Choose the right tool based on user intent:

- **show_carousel**: Best for showcasing multiple items horizontally (restaurants,
  products, places). Use when the user asks for recommendations or wants to browse options.

- **show_list**: Best for ranked/ordered content (top 10 lists, search results,
  task lists). Use when order matters or items need detailed metadata.

- **show_gallery**: Best for image-focused content (photo albums, portfolios).
  Use when visuals are the primary content.

- **show_dashboard**: Best for metrics and analytics (KPIs, account overviews,
  stats). Use when showing numerical data or status information.

- **show_card**: Basic interactive widget. Use for simple single-item displays
  or when other widgets don't fit.

- **show_solar_system**: Educational 3D visualization. Use for astronomy topics
  or interactive learning experiences.

- **show_todo**: Task management interface. Use when the user wants to organize
  tasks, create lists, or track progress.

- **show_shop**: E-commerce cart interface. Use for shopping, checkout flows,
  or product quantity management.

- **show_travel_map**: Interactive map with places of interest. Use for travel
  planning, showing hotels/restaurants/attractions in a specific location.

### Important Notes

- All widgets support both light and dark themes automatically
- Widgets are responsive and work on mobile and desktop
- Each tool returns sample data by default - in production, connect to real data sources
- Use the `title` parameter to customize the widget header
"""

mcp = FastMCP(name="boilerplate-server", instructions=SERVER_INSTRUCTIONS, stateless_http=True)


def get_tool_meta(widget: Widget) -> Dict[str, Any]:
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
        "openai/resultCanProduceWidget": True,
    }


def get_invocation_meta(widget: Widget) -> Dict[str, Any]:
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }


# =============================================================================
# TOOL REGISTRATION
# =============================================================================

# Map widget identifiers to their input models for proper schema generation
WIDGET_INPUT_MODELS: Dict[str, type] = {
    "show_card": CardInput,
    "show_carousel": CarouselInput,
    "show_list": ListInput,
    "show_gallery": GalleryInput,
    "show_dashboard": DashboardInput,
    "show_solar_system": SolarSystemInput,
    "show_todo": TodoInput,
    "show_shop": ShopInput,
    "show_travel_map": TravelMapInput,
}


def get_tool_schema(widget_id: str) -> Dict[str, Any]:
    """Generate JSON Schema from the Pydantic model for a widget."""
    model_class = WIDGET_INPUT_MODELS.get(widget_id)
    if not model_class:
        return {"type": "object", "properties": {}, "additionalProperties": False}

    # Generate schema from Pydantic model
    pydantic_schema = model_class.model_json_schema()

    # Convert to MCP-compatible format (remove $defs and other extras)
    properties = {}
    for field_name, field_info in pydantic_schema.get("properties", {}).items():
        prop = {"type": field_info.get("type", "string")}
        if "description" in field_info:
            prop["description"] = field_info["description"]
        if "default" in field_info:
            prop["default"] = field_info["default"]
        properties[field_name] = prop

    return {
        "type": "object",
        "properties": properties,
        "additionalProperties": False,
    }


@mcp._mcp_server.list_tools()
async def list_tools() -> List[types.Tool]:
    tools = []

    for widget in WIDGETS:
        schema = get_tool_schema(widget.identifier)

        tools.append(types.Tool(
            name=widget.identifier,
            title=widget.title,
            description=widget.description,
            inputSchema=schema,
            _meta=get_tool_meta(widget),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        ))

    return tools


# =============================================================================
# RESOURCE REGISTRATION
# =============================================================================

@mcp._mcp_server.list_resources()
async def list_resources() -> List[types.Resource]:
    return [
        types.Resource(
            name=widget.title,
            title=widget.title,
            uri=widget.template_uri,
            description=f"{widget.title} widget markup",
            mimeType=MIME_TYPE,
            _meta=get_tool_meta(widget),
        )
        for widget in WIDGETS
    ]


@mcp._mcp_server.list_resource_templates()
async def list_resource_templates() -> List[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            name=widget.title,
            title=widget.title,
            uriTemplate=widget.template_uri,
            description=f"{widget.title} widget markup",
            mimeType=MIME_TYPE,
            _meta=get_tool_meta(widget),
        )
        for widget in WIDGETS
    ]


# =============================================================================
# REQUEST HANDLERS
# =============================================================================

async def handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    widget = WIDGETS_BY_URI.get(str(req.params.uri))
    if widget is None:
        return types.ServerResult(types.ReadResourceResult(contents=[], _meta={"error": f"Unknown resource: {req.params.uri}"}))

    return types.ServerResult(types.ReadResourceResult(contents=[
        types.TextResourceContents(uri=widget.template_uri, mimeType=MIME_TYPE, text=widget.html, _meta=get_tool_meta(widget))
    ]))


async def handle_call_tool(req: types.CallToolRequest) -> types.ServerResult:
    tool_name = req.params.name
    arguments = req.params.arguments or {}

    widget = WIDGETS_BY_ID.get(tool_name)
    if not widget:
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=f"Unknown tool: {tool_name}")],
            isError=True,
        ))

    # Route to appropriate handler based on tool name
    if tool_name == "show_card":
        return await handle_card(widget, arguments)
    elif tool_name == "show_carousel":
        return await handle_carousel(widget, arguments)
    elif tool_name == "show_list":
        return await handle_list(widget, arguments)
    elif tool_name == "show_gallery":
        return await handle_gallery(widget, arguments)
    elif tool_name == "show_dashboard":
        return await handle_dashboard(widget, arguments)
    elif tool_name == "show_solar_system":
        return await handle_solar_system(widget, arguments)
    elif tool_name == "show_todo":
        return await handle_todo(widget, arguments)
    elif tool_name == "show_shop":
        return await handle_shop(widget, arguments)
    elif tool_name == "show_travel_map":
        return await handle_travel_map(widget, arguments)
    else:
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=f"No handler for: {tool_name}")],
            isError=True,
        ))


def format_validation_error(e: ValidationError, input_class: type) -> str:
    """Format Pydantic validation errors into actionable messages."""
    errors = e.errors()
    field_errors = []
    for err in errors:
        field = ".".join(str(x) for x in err["loc"]) if err["loc"] else "input"
        msg = err["msg"]
        field_errors.append(f"  - {field}: {msg}")

    # Get valid field names from the model
    valid_fields = list(input_class.model_fields.keys())

    error_msg = f"Validation error. Issues:\n"
    error_msg += "\n".join(field_errors)
    error_msg += f"\n\nValid fields: {', '.join(valid_fields)}"
    return error_msg


async def handle_card(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = CardInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, CardInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "message": payload.message,
        "accentColor": payload.accent_color,
        "items": [
            {"id": "1", "name": "First Item", "description": "Sample item description"},
            {"id": "2", "name": "Second Item", "description": "Another sample item"},
            {"id": "3", "name": "Third Item", "description": "One more item"},
        ],
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Card widget: {payload.title}")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_carousel(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = CarouselInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, CarouselInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "items": SAMPLE_CAROUSEL_ITEMS,
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Carousel: {payload.title} ({len(SAMPLE_CAROUSEL_ITEMS)} items)")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_list(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = ListInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, ListInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "subtitle": payload.subtitle,
        "headerImage": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop",
        "actionLabel": "Save List",
        "items": SAMPLE_LIST_ITEMS,
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"List: {payload.title} ({len(SAMPLE_LIST_ITEMS)} items)")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_gallery(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = GalleryInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, GalleryInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "images": SAMPLE_GALLERY_IMAGES,
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Gallery: {payload.title} ({len(SAMPLE_GALLERY_IMAGES)} photos)")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_dashboard(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = DashboardInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, DashboardInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "subtitle": "Your key metrics at a glance",
        "period": payload.period,
        "stats": SAMPLE_DASHBOARD_STATS,
        "activities": SAMPLE_ACTIVITIES,
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Dashboard: {payload.title}")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_solar_system(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = SolarSystemInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, SolarSystemInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "planet_name": payload.planet_name or "",  # Empty string instead of null
    }

    planet_msg = f" (focusing on {payload.planet_name})" if payload.planet_name else ""
    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Solar System{planet_msg}")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_todo(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = TodoInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, TodoInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "lists": deepcopy(SAMPLE_TODO_LISTS),
    }

    total_todos = sum(len(lst["todos"]) for lst in SAMPLE_TODO_LISTS)
    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Todo: {len(SAMPLE_TODO_LISTS)} lists, {total_todos} items")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_shop(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = ShopInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, ShopInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "cartItems": deepcopy(SAMPLE_CART_ITEMS),
    }

    total_items = sum(item["quantity"] for item in SAMPLE_CART_ITEMS)
    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Shopping Cart: {total_items} items")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


async def handle_travel_map(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = TravelMapInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, TravelMapInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        "subtitle": payload.subtitle,
        "places": deepcopy(SAMPLE_MAP_PLACES),
        "center": {"lat": 37.7949, "lng": -122.4094},
        "zoom": 13,
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"Travel Map: {payload.title} ({len(SAMPLE_MAP_PLACES)} places)")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))


# Register handlers
mcp._mcp_server.request_handlers[types.CallToolRequest] = handle_call_tool
mcp._mcp_server.request_handlers[types.ReadResourceRequest] = handle_read_resource


# =============================================================================
# HTTP APP SETUP
# =============================================================================

app = mcp.streamable_http_app()

try:
    from starlette.middleware.cors import CORSMiddleware
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False)
except Exception:
    pass

# Serve static assets (widget JS/CSS bundles)
try:
    from starlette.staticfiles import StaticFiles
    if ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
except Exception:
    pass


# =============================================================================
# SIMULATOR CHAT API
# =============================================================================

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
import json as json_module


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str
    conversation_id: Optional[str] = "default"
    model_config = ConfigDict(extra="forbid")


class WidgetData(BaseModel):
    """Widget data returned from chat."""
    tool_name: str
    html: str
    tool_output: Dict[str, Any]
    model_config = ConfigDict(extra="forbid")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    message: str
    widget: Optional[WidgetData] = None
    conversation_id: str
    model_config = ConfigDict(extra="forbid")


async def chat_endpoint(request: Request) -> JSONResponse:
    """
    Chat endpoint for the local simulator.
    Receives a message, runs it through the OpenAI agent with MCP tools,
    and returns the response with any widget data.
    """
    try:
        body = await request.json()
        chat_request = ChatRequest.model_validate(body)
    except Exception as e:
        return JSONResponse(
            {"error": f"Invalid request: {e}"},
            status_code=400
        )

    try:
        # Import here to avoid circular imports
        from agent_runner import run_agent, WidgetResult

        result = await run_agent(
            prompt=chat_request.message,
            conversation_id=chat_request.conversation_id or "default"
        )

        # Build response
        widget_data = None
        if result.widget:
            widget_data = WidgetData(
                tool_name=result.widget.tool_name,
                html=result.widget.html,
                tool_output=result.widget.tool_output
            )

        response = ChatResponse(
            message=result.message,
            widget=widget_data,
            conversation_id=chat_request.conversation_id or "default"
        )

        return JSONResponse(response.model_dump())

    except Exception as e:
        return JSONResponse(
            {"error": str(e), "message": f"Error processing request: {e}"},
            status_code=500
        )


async def reset_chat_endpoint(request: Request) -> JSONResponse:
    """Reset conversation history."""
    try:
        body = await request.json()
        conversation_id = body.get("conversation_id", "default")
    except Exception:
        conversation_id = "default"

    try:
        from agent_runner import clear_conversation
        clear_conversation(conversation_id)
        return JSONResponse({"status": "ok", "conversation_id": conversation_id})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# =============================================================================
# SIMULATOR STATUS & TOOLS API (for Puter.js fallback)
# =============================================================================

async def chat_status_endpoint(request: Request) -> JSONResponse:
    """
    Check if OpenAI API key is configured.
    Used by frontend to decide whether to use backend agent or Puter.js fallback.
    """
    import os
    from pathlib import Path
    from dotenv import load_dotenv

    # Load .env file
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)

    has_api_key = bool(os.getenv("OPENAI_API_KEY"))

    return JSONResponse({
        "has_api_key": has_api_key,
        "fallback_available": True,  # Puter.js is always available
    })


async def tools_list_endpoint(request: Request) -> JSONResponse:
    """
    Return tool definitions in OpenAI function calling format.
    Used by Puter.js fallback to get available tools.
    """
    tools = []

    for widget in WIDGETS:
        tools.append({
            "type": "function",
            "function": {
                "name": widget.identifier,
                "description": widget.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Widget title"
                        }
                    },
                    "required": []
                }
            }
        })

    return JSONResponse({"tools": tools})


async def tool_call_endpoint(request: Request) -> JSONResponse:
    """
    Execute a tool and return the result.
    Used by Puter.js fallback to call MCP tools.
    """
    try:
        body = await request.json()
        tool_name = body.get("name")
        arguments = body.get("arguments", {})

        if not tool_name:
            return JSONResponse({"error": "Missing tool name"}, status_code=400)

        widget = WIDGETS_BY_ID.get(tool_name)
        if not widget:
            return JSONResponse({"error": f"Unknown tool: {tool_name}"}, status_code=404)

        # Create a mock request and call the handler
        import mcp.types as types
        mock_req = types.CallToolRequest(
            method="tools/call",
            params=types.CallToolRequestParams(name=tool_name, arguments=arguments)
        )

        result = await handle_call_tool(mock_req)

        # Extract structured content from result
        if hasattr(result, 'root') and hasattr(result.root, 'structuredContent'):
            structured_content = result.root.structuredContent
        else:
            structured_content = {}

        return JSONResponse({
            "tool_name": tool_name,
            "html": widget.html,
            "tool_output": structured_content,
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Add chat routes to the app
app.routes.append(Route("/chat", chat_endpoint, methods=["POST"]))
app.routes.append(Route("/chat/reset", reset_chat_endpoint, methods=["POST"]))
app.routes.append(Route("/chat/status", chat_status_endpoint, methods=["GET"]))
app.routes.append(Route("/tools", tools_list_endpoint, methods=["GET"]))
app.routes.append(Route("/tools/call", tool_call_endpoint, methods=["POST"]))


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 60)
    print("ChatGPT App Template - MCP Server")
    print("=" * 60)
    print("\nAvailable widgets:")
    for w in WIDGETS:
        print(f"  - {w.identifier}: {w.description[:50]}...")
    print("\nMake sure to run `pnpm run build` to build widgets first.")
    print("\nServer: http://0.0.0.0:8000")
    print("MCP endpoint: http://0.0.0.0:8000/mcp")
    print("Assets: http://0.0.0.0:8000/assets/")
    print("=" * 60 + "\n")

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
