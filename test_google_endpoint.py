import asyncio
import httpx
import json

async def test():
    body = {'access_token': 'test_token'}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post('http://localhost:8000/api/v1/google/events', json=body)
            print(f'Status: {resp.status_code}')
            print(f'Response: {resp.text[:1000]}')
        except Exception as e:
            print(f'Error: {e}')

asyncio.run(test())
