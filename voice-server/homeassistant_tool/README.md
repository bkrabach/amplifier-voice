# Home Assistant Integration Tool

A comprehensive Python client for Home Assistant with both REST and WebSocket support.

## Features

- **Synchronous REST API** - Simple blocking calls for quick operations
- **Asynchronous WebSocket API** - Real-time event subscriptions and state monitoring
- **Secure Credential Handling** - Tokens stored as SecretStr, masked in logs
- **SSL/TLS Support** - Custom certificates for self-signed setups
- **Comprehensive Data Models** - Pydantic models for type safety
- **Unified Client Facade** - Single interface for both REST and WebSocket

## Installation

```bash
# Install from source
cd homeassistant_tool
pip install -e .

# Or with dev dependencies
pip install -e ".[dev]"
```

## Configuration

### Required Credentials

You need a **Long-Lived Access Token** from Home Assistant:

1. Go to your Home Assistant instance
2. Click your profile (bottom left)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Copy the token (it's only shown once!)

### Configuration Methods

#### Method 1: Environment Variables (Recommended)

```bash
export HA_HOST="192.168.1.100"
export HA_PORT="8123"
export HA_ACCESS_TOKEN="your_long_lived_token_here"
export HA_USE_SSL="false"
```

#### Method 2: .env File

Create a `.env` file in your project directory:

```env
HA_HOST=192.168.1.100
HA_PORT=8123
HA_ACCESS_TOKEN=your_long_lived_token_here
HA_USE_SSL=false
```

#### Method 3: Direct Parameters

```python
from homeassistant_tool import create_client

client = create_client(
    host="192.168.1.100",
    port=8123,
    access_token="your_token_here",
    use_ssl=False
)
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `HA_HOST` | localhost | Home Assistant hostname or IP |
| `HA_PORT` | 8123 | Home Assistant port |
| `HA_ACCESS_TOKEN` | (required) | Long-lived access token |
| `HA_USE_SSL` | false | Use HTTPS/WSS |
| `HA_SSL_VERIFY` | true | Verify SSL certificates |
| `HA_SSL_CERT_PATH` | (none) | Custom CA certificate path |
| `HA_CONNECTION_TIMEOUT` | 10.0 | Connection timeout (seconds) |
| `HA_REQUEST_TIMEOUT` | 30.0 | Request timeout (seconds) |

## Usage

### Basic Usage (REST API)

```python
from homeassistant_tool import HomeAssistantClient

# Create client from environment
client = HomeAssistantClient.from_env()

# Check connection
if client.check_connection():
    print("Connected to Home Assistant!")

# Get all entity states
states = client.get_states()
for entity in states:
    print(f"{entity.entity_id}: {entity.state}")

# Get specific entity
light = client.get_state("light.living_room")
print(f"Light is {'on' if light.is_on() else 'off'}")

# Control entities
client.turn_on("light.living_room", brightness=128)
client.turn_off("switch.garden_lights")
client.toggle("light.bedroom")

# Call any service
client.call_service(
    domain="climate",
    service="set_temperature",
    service_data={"temperature": 22},
    target={"entity_id": "climate.living_room"}
)
```

### Real-time Events (WebSocket API)

```python
import asyncio
from homeassistant_tool import HomeAssistantClient

async def main():
    client = HomeAssistantClient.from_env()
    
    # Connect WebSocket
    await client.connect_websocket()
    
    # Define callback for state changes
    def on_state_change(event):
        print(f"Entity: {event.entity_id}")
        if event.new_state:
            print(f"  New state: {event.new_state.state}")
    
    # Subscribe to state changes
    await client.subscribe_state_changes(on_state_change)
    
    # Listen for events (runs until disconnected)
    await client.listen()

asyncio.run(main())
```

### Async Context Manager

```python
async def main():
    async with HomeAssistantClient.from_env() as client:
        await client.connect_websocket()
        
        # Get states via WebSocket
        states = await client.async_get_states()
        
        # Call service via WebSocket
        await client.async_turn_on("light.kitchen")
        
        # Subscribe and listen
        await client.subscribe_state_changes(my_callback)
        await client.listen()
```

### Mixed Sync/Async Usage

```python
client = HomeAssistantClient.from_env()

# Sync REST calls
states = client.get_states()  # Sync

# Async WebSocket calls
await client.connect_websocket()
await client.async_call_service("light", "turn_on", ...)  # Async
```

## API Reference

### HomeAssistantClient

Main unified client with both REST and WebSocket methods.

#### State Methods
- `get_states()` - Get all entity states (REST)
- `get_state(entity_id)` - Get specific entity state (REST)
- `async_get_states()` - Get all states (WebSocket)

#### Service Methods
- `call_service(domain, service, ...)` - Call service (REST)
- `async_call_service(domain, service, ...)` - Call service (WebSocket)
- `turn_on(entity_id, **kwargs)` - Turn on entity
- `turn_off(entity_id)` - Turn off entity
- `toggle(entity_id)` - Toggle entity

#### Event Subscriptions (WebSocket)
- `subscribe_events(callback, event_type)` - Subscribe to events
- `subscribe_state_changes(callback)` - Subscribe to state changes
- `unsubscribe_events(subscription_id)` - Unsubscribe

#### Registry Methods
- `get_areas()` - Get all areas
- `get_devices()` - Get all devices
- `get_entity_registry()` - Get entity registry

### Models

- `Entity` - Entity with state and attributes
- `Service` - Service definition
- `Event` - Home Assistant event
- `StateChangedEventData` - State change event data
- `Area`, `Device`, `EntityRegistryEntry` - Registry models

## Security Best Practices

1. **Never commit tokens** - Use environment variables or .env files (gitignored)
2. **Use SSL in production** - Set `HA_USE_SSL=true` for external access
3. **Verify certificates** - Only disable `HA_SSL_VERIFY` for development
4. **Rotate tokens** - Periodically regenerate long-lived access tokens
5. **Limit token scope** - Use tokens with minimal required permissions

## Error Handling

```python
from homeassistant_tool import (
    HomeAssistantClient,
    AuthenticationError,
    ConnectionError,
    EntityNotFoundError,
)

try:
    client = HomeAssistantClient.from_env()
    state = client.get_state("light.nonexistent")
except AuthenticationError:
    print("Invalid access token")
except ConnectionError:
    print("Cannot connect to Home Assistant")
except EntityNotFoundError as e:
    print(f"Entity not found: {e.entity_id}")
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/

# Type checking
pyright homeassistant_tool/

# Linting
ruff check homeassistant_tool/
ruff format homeassistant_tool/
```

## License

MIT License
