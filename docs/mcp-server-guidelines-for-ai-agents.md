# MCP Server Development Guidelines for AI Coding Agents

> **Purpose**: This document provides actionable guidelines for building production-quality MCP (Model Context Protocol) servers. Follow these rules strictly.

---

## 1. CORE DESIGN PRINCIPLES

### 1.1 Design for Agents, Not Humans

**WRONG approach** - Exposing every REST endpoint as a separate tool:

```python
# BAD: Too many overlapping tools
@mcp.tool
def get_user(user_id: str): ...

@mcp.tool  
def get_user_by_email(email: str): ...

@mcp.tool
def get_user_by_username(username: str): ...
```

**CORRECT approach** - One unified, well-designed tool:

```python
# GOOD: Single flexible tool
@mcp.tool
def find_user(
    identifier: str,
    search_type: Literal["id", "email", "username", "search"] = "search"
) -> User:
    """
    Find a user by various methods.
    
    Args:
        identifier: The user ID, email, username, or search query
        search_type: How to interpret the identifier
    
    Returns:
        User object with id, email, name, created_at
    """
```

### 1.2 Tool Count Guidelines

| Server Type | Recommended Tool Count | Rationale |
|-------------|----------------------|-----------|
| Focused utility | 3-7 tools | Single responsibility |
| Platform integration | 10-20 tools | Organized into toolsets |
| Enterprise gateway | 20-50 tools | Must use toolsets/filtering |

**Rule**: If you have more than 10 tools, implement toolset filtering so users can load only what they need.

### 1.3 Tool Naming Conventions

Use `verb_noun` format, lowercase with underscores:

```python
# GOOD naming
def get_issue(issue_id: str): ...
def create_pull_request(title: str, body: str): ...
def search_code(query: str, repo: str): ...

# BAD naming - avoid these patterns
def Issue(id: str): ...           # PascalCase
def getPullRequest(id: str): ...  # camelCase  
def code_search(q: str): ...      # noun_verb order
```

---

## 2. TOOL IMPLEMENTATION

### 2.1 Always Provide Rich Descriptions

Every tool MUST have:
- A clear description of what it does
- When to use it (use cases)
- All argument descriptions with types
- Return value description with field details
- At least one example

```python
@mcp.tool
def search_issues(
    query: str,
    repo: str | None = None,
    state: Literal["open", "closed", "all"] = "open",
    max_results: int = 10
) -> list[Issue]:
    """
    Search for issues across repositories using GitHub search syntax.
    
    Use this tool when the user wants to:
    - Find issues matching specific criteria
    - Look up bugs or feature requests
    - Get an overview of open work
    
    Args:
        query: Search query. Supports GitHub search syntax like 
               "bug label:high-priority" or "author:username"
        repo: Optional. Limit search to specific repo (format: owner/repo)
        state: Filter by issue state
        max_results: Maximum number of results to return (1-100)
    
    Returns:
        List of Issue objects containing:
        - id: Issue number
        - title: Issue title
        - state: open/closed
        - author: Username who created the issue
        - labels: List of label names
        - url: Direct link to the issue
    
    Example:
        search_issues("memory leak", repo="fastmcp/fastmcp", state="open")
    """
```

### 2.2 Return Structured Data

Always use Pydantic models for outputs:

```python
from pydantic import BaseModel

# GOOD: Structured output with clear schema
class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    relevance_score: float
    url: str

@mcp.tool
def search_docs(query: str) -> list[SearchResult]:
    """Search documentation and return structured results."""
    ...

# BAD: Unstructured string output - LLM cannot parse reliably
@mcp.tool
def search_docs_bad(query: str) -> str:
    return f"Found 3 results for {query}..."
```

### 2.3 Handle Errors Gracefully

Return helpful error messages that suggest next steps:

```python
@mcp.tool
async def get_file(path: str, ctx: Context) -> str:
    """Read a file from the workspace."""
    try:
        # Validate input
        if ".." in path or path.startswith("/"):
            return "Error: Path traversal not allowed. Use relative paths only."
        
        # Check existence
        if not os.path.exists(path):
            return f"Error: File not found: {path}. Use list_files() to see available files."
        
        # Check size
        size = os.path.getsize(path)
        if size > 1_000_000:  # 1MB
            return f"Error: File too large ({size} bytes). Use get_file_chunk() for large files."
        
        with open(path) as f:
            return f.read()
            
    except PermissionError:
        return f"Error: Permission denied for {path}"
    except Exception as e:
        await ctx.log(level="error", data=f"get_file failed: {e}")
        return f"Error: Failed to read file: {type(e).__name__}"
```

### 2.4 Use Progress Reporting for Long Operations

```python
@mcp.tool
async def analyze_codebase(repo_path: str, ctx: Context) -> AnalysisResult:
    """Analyze an entire codebase for issues."""
    files = list(Path(repo_path).rglob("*.py"))
    total = len(files)
    
    results = []
    for i, file in enumerate(files):
        await ctx.report_progress(
            progress=i,
            total=total,
            message=f"Analyzing {file.name}"
        )
        results.append(analyze_file(file))
    
    return AnalysisResult(files_analyzed=total, issues=results)
```

---

## 3. SERVER INSTRUCTIONS (CRITICAL)

Always provide server instructions to guide LLM behavior. This is like a system prompt for your server:

```python
from fastmcp import FastMCP

server = FastMCP(
    name="github-server",
    instructions="""
    ## GitHub MCP Server Usage Guide
    
    ### Tool Selection
    - For finding issues/PRs: use search_issues or search_pull_requests
    - For reading code: use get_file_contents with the full path
    - For making changes: ALWAYS create a branch first with create_branch
    
    ### Workflows
    
    **Reviewing a Pull Request:**
    1. First call get_pull_request to get the PR details
    2. Then call get_pull_request_diff to see the changes
    3. Use get_file_contents if you need full context of changed files
    4. Finally use create_review to submit your review
    
    **Creating a PR:**
    1. Call create_branch with a descriptive branch name
    2. Make changes with update_file (one file at a time)
    3. Call create_pull_request with a clear title and description
    
    ### Important Notes
    - Always use pagination: set per_page=10 for initial queries
    - Repository format is always owner/repo
    - Dates are in ISO 8601 format
    """
)
```

---

## 4. RESOURCES (for static/reference data)

Use resources for data that does not change per-request:

```python
# Static configuration
@mcp.resource("config://app/settings")
def get_app_settings() -> str:
    """Application configuration settings."""
    return json.dumps(load_config())

# Reference documentation
@mcp.resource("schema://database/tables")  
def get_db_schema() -> str:
    """Database schema for reference."""
    return generate_schema_docs()

# Parameterized static content
@mcp.resource("docs://api/{endpoint}")
def get_api_docs(endpoint: str) -> str:
    """API documentation for a specific endpoint."""
    return load_docs(endpoint)
```

**Rule**: Use resources for reference data, tools for actions.

---

## 5. SECURITY REQUIREMENTS

### 5.1 Input Validation

```python
import re
from pathlib import Path

ALLOWED_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9_\-./]+$')
MAX_QUERY_LENGTH = 1000

@mcp.tool
def read_file(path: str) -> str:
    """Read a file from the allowed workspace."""
    # Validate characters
    if not ALLOWED_PATH_PATTERN.match(path):
        raise ValueError("Invalid characters in path")
    
    # Prevent path traversal
    resolved = Path(path).resolve()
    workspace = Path("/workspace").resolve()
    if not str(resolved).startswith(str(workspace)):
        raise ValueError("Access denied: path outside workspace")
    
    # Block sensitive file types
    if resolved.suffix in ['.env', '.key', '.pem', '.secret']:
        raise ValueError("Access denied: sensitive file type")
    
    return resolved.read_text()
```

### 5.2 Authentication (for remote servers)

Use established OAuth providers - NEVER roll your own:

```python
from fastmcp import FastMCP
from fastmcp.server.auth import OAuthProvider

server = FastMCP(
    name="my-server",
    auth=OAuthProvider(
        provider="github",  # or "google", "azure", "auth0"
        client_id=os.environ["OAUTH_CLIENT_ID"],
        client_secret=os.environ["OAUTH_CLIENT_SECRET"],
        scopes=["read:user", "repo"]
    )
)
```

### 5.3 Secrets Management

```python
# GOOD: Use environment variables
import os

@mcp.tool
def call_api(endpoint: str) -> dict:
    api_key = os.environ.get("API_KEY")
    if not api_key:
        raise RuntimeError("API_KEY not configured")
    ...

# BAD: NEVER hardcode secrets
API_KEY = "sk-1234567890"  # ABSOLUTELY FORBIDDEN
```

---

## 6. TESTING

### 6.1 Write Deterministic Tests (Not Vibe Tests)

```python
import pytest
from fastmcp import Client

@pytest.fixture
async def client():
    """Create test client with in-memory transport."""
    async with Client(server) as client:
        yield client

async def test_search_returns_structured_results(client):
    """Test that search returns properly structured data."""
    result = await client.call_tool("search_issues", {
        "query": "bug",
        "max_results": 5
    })
    
    # Assert structure, not exact content
    assert isinstance(result, list)
    assert len(result) <= 5
    for item in result:
        assert "id" in item
        assert "title" in item
        assert "state" in item

async def test_invalid_input_returns_error(client):
    """Test that invalid input is handled gracefully."""
    result = await client.call_tool("get_file", {
        "path": "../../../etc/passwd"
    })
    assert "Error" in result or "denied" in result.lower()

async def test_missing_resource_returns_helpful_message(client):
    """Test that missing resources give actionable feedback."""
    result = await client.call_tool("get_file", {
        "path": "nonexistent.txt"
    })
    assert "not found" in result.lower()
    assert "list_files" in result  # Suggests alternative action
```

### 6.2 Test Edge Cases

```python
@pytest.mark.parametrize("query,expected_error", [
    ("", "empty"),
    ("a" * 10000, "too long"),
    ("'; DROP TABLE users;--", None),  # Should handle safely
])
async def test_search_input_validation(client, query, expected_error):
    result = await client.call_tool("search", {"query": query})
    if expected_error:
        assert expected_error in result.lower() or "error" in result.lower()
```

---

## 7. PROJECT STRUCTURE

```
my-mcp-server/
├── src/
│   └── my_mcp_server/
│       ├── __init__.py
│       ├── server.py          # Main FastMCP server definition
│       ├── tools/
│       │   ├── __init__.py
│       │   ├── search.py      # Search-related tools
│       │   ├── crud.py        # Create/read/update/delete tools
│       │   └── analysis.py    # Analysis tools
│       ├── resources/
│       │   └── __init__.py    # Resource definitions
│       ├── models.py          # Pydantic models for inputs/outputs
│       └── config.py          # Configuration handling
├── tests/
│   ├── conftest.py            # Pytest fixtures
│   ├── test_tools.py          # Tool tests
│   └── test_integration.py    # Integration tests
├── pyproject.toml
├── README.md
└── .env.example               # Example environment variables
```

### 7.1 Server Entry Point Pattern

```python
# src/my_mcp_server/server.py
from fastmcp import FastMCP
from .tools import search, crud, analysis
from .config import Settings

INSTRUCTIONS = """Your server instructions here..."""

def create_server(settings: Settings | None = None) -> FastMCP:
    """Factory function for creating the MCP server."""
    settings = settings or Settings()
    
    server = FastMCP(
        name="my-server",
        instructions=INSTRUCTIONS,
    )
    
    # Register tools from modules
    search.register(server, settings)
    crud.register(server, settings)
    analysis.register(server, settings)
    
    return server

# For direct execution
server = create_server()

if __name__ == "__main__":
    server.run()
```

---

## 8. ANTI-PATTERNS TO AVOID

### Anti-Pattern 1: Auto-converting REST APIs
```python
# DO NOT do this - it creates context pollution
for endpoint in openapi_spec["paths"]:
    server.tool(create_wrapper(endpoint))
```

### Anti-Pattern 2: Returning raw API responses
```python
# DO NOT pass through unprocessed responses
@mcp.tool
def get_data(id: str) -> dict:
    response = requests.get(f"{API_URL}/{id}")
    return response.json()  # Raw, unvalidated, potentially huge
```

### Anti-Pattern 3: Vague descriptions
```python
# DO NOT write useless descriptions
@mcp.tool
def process(data: str) -> str:
    """Process the data."""  # What data? How? What output?
```

### Anti-Pattern 4: No error context
```python
# DO NOT return generic errors
@mcp.tool
def fetch(url: str) -> str:
    try:
        return requests.get(url).text
    except:
        return "Error"  # Useless for debugging
```

### Anti-Pattern 5: Unbounded operations
```python
# DO NOT allow unbounded results
@mcp.tool
def list_all_files(path: str) -> list[str]:
    return [str(f) for f in Path(path).rglob("*")]  # Could be millions!
```

---

## 9. PRE-SHIP CHECKLIST

Before deploying, verify:

- [ ] Each tool has a clear, specific purpose (no overlap)
- [ ] All tools have detailed docstrings with examples
- [ ] Input validation on all parameters
- [ ] Structured return types (Pydantic models)
- [ ] Error messages are actionable (suggest what to do next)
- [ ] Server instructions explain tool relationships and workflows
- V ound appy path AND edge cases
- [ ] No hardcoded secrets (use env vars)
- [ ] Pagination implemented for list operations
- [ ] Progress reporting for operations > 2 seconds
- [ ] Resource limits in place (max results, file sizes)
- [ ] README with quick start and configuration docs

---

## 10. MINIMAL SERVER TEMPLATE

Copy this template to get started:

```python
from fastmcp import FastMCP
from pydantic import BaseModel
import os

# Define output models
class OutputModel(BaseModel):
    id: str
    data: dict
    message: str

# Create server with instructions
server = FastMCP(
    name="my-server",
    instructions="""
    ## My MCP Server
    
    This server provides [DESCRIBE PURPOSE].
    
    ### Available Tools
    - my_tool: Use this when [DESCRIBE WHEN TO USE]
    
    ### Common Workflows
    1. First call X to get context
    2. Then call Y to perform the action
    """
)

@server.tool
def my_tool(
    required_param: str,
    optional_param: int = 10
) -> OutputModel:
    """
    Clear description of what this tool does.
    
    Use this tool when:
    - The user wants to [USE CASE 1]
    - The user needs to [USE CASE 2]
    
    Args:
        required_param: What this parameter is for
        optional_param: What this controls (default: 10)
    
    Returns:
        OutputModel containing:
        - id: Unique identifier for the result
        - data: The processed data as a dictionary
        - message: Human-readable status message
        
    Example:
        my_tool("example_input", optional_param=20)
    """
    # Validate input
    if not required_param:
        return OutputModel(
            id="",
            data={},
            message="Error: required_param cannot be empty"
        )
    
    # Implementation here
    result = {"processed": required_param, "count": optional_param}
    
    return OutputModel(
        id="result-123",
        data=result,
        message=f"Successfully processed with {optional_param} iterations"
    )

if __name__ == "__main__":
    server.run()
```

---

## Sources

- Official MCP Specification 2025-11-25: https://modelcontextprotocol.io/specification/2025-11-25
- FastMCP Documentation: https://gofastmcp.com
- Jeremiah Lowin (FastMCP Creator): https://jlowin.dev/blog
- Den Delimarsky (MCP Core Maintainer): https://den.dev/blog
- GitHub MCP Best Practices: https://github.blog/ai-and-ml/generative-ai/how-to-build-secure-and-scalable-remote-mcp-servers/
