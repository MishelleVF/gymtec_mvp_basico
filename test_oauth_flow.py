import asyncio
import httpx
import json

async def test_oauth_flow():
    """Test the complete OAuth flow."""
    
    # Step 1: Get auth URL
    print("Step 1: Getting auth URL...")
    async with httpx.AsyncClient() as client:
        resp = await client.get('http://localhost:8000/api/v1/google/auth-url')
        print(f'Status: {resp.status_code}')
        if resp.status_code == 200:
            data = resp.json()
            print(f'Auth URL: {data.get("url", "")[:100]}...')
        else:
            print(f'Error: {resp.text}')
            return
    
    # Step 2: Simulate callback with a test code (this will fail because the code is invalid)
    # But it will help us see what error Google returns
    print("\nStep 2: Trying to exchange a dummy code...")
    async with httpx.AsyncClient() as client:
        body = {'code': 'invalid_test_code_12345'}
        resp = await client.post('http://localhost:8000/api/v1/google/callback', json=body)
        print(f'Status: {resp.status_code}')
        print(f'Response: {resp.text[:500]}')

asyncio.run(test_oauth_flow())
