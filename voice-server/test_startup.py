#!/usr/bin/env python3
"""Quick test to verify server can start and Amplifier initializes."""

import asyncio
import sys
from pathlib import Path

# Add voice_server to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_startup():
    print("=" * 60)
    print("Testing Amplifier Voice Server Startup")
    print("=" * 60)
    
    print("\n1. Testing imports...")
    try:
        from voice_server import settings
        print(f"   ✓ Settings loaded")
        print(f"   - Amplifier bundle: {settings.amplifier.bundle}")
        print(f"   - CWD: {settings.amplifier.cwd}")
    except Exception as e:
        print(f"   ✗ Failed to load settings: {e}")
        return False
    
    print("\n2. Testing Amplifier bridge initialization...")
    try:
        from voice_server.amplifier_bridge import get_amplifier_bridge
        
        bridge = await get_amplifier_bridge(
            bundle=settings.amplifier.bundle,
            cwd=settings.amplifier.cwd
        )
        
        tools = bridge.get_tools()
        print(f"   ✓ Bridge initialized")
        print(f"   - Tools available: {len(tools)}")
        if tools:
            # Tools are in OpenAI format: {"type": "function", "name": ..., "description": ...}
            sample_names = [t.get('name', 'unknown') for t in tools[:5]]
            print(f"   - Sample tools: {sample_names}")
        
        # Test tool execution
        print("\n3. Testing tool execution...")
        test_result = await bridge.execute_tool(
            "read_file",
            {"file_path": __file__}
        )
        if test_result.success:
            print(f"   ✓ Tool execution works")
        else:
            print(f"   ✗ Tool execution failed: {test_result.error}")
            return False
            
    except Exception as e:
        print(f"   ✗ Failed to initialize bridge: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n4. Testing FastAPI app creation...")
    try:
        from voice_server.start import create_app
        app = create_app()
        print(f"   ✓ FastAPI app created")
        routes = [r.path for r in app.routes if hasattr(r, 'path')]
        print(f"   - Routes: {routes}")
    except Exception as e:
        print(f"   ✗ Failed to create app: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED - Server is ready!")
    print("=" * 60)
    print("\nTo start the server:")
    print("  cd /Users/brkrabac/repos/realtime-voice/amplifier-voice/voice-server")
    print("  .venv/bin/python -m voice_server.start")
    print("\nOr with custom port:")
    print("  .venv/bin/python -m voice_server.start --port 8080")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_startup())
    sys.exit(0 if success else 1)
