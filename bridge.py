import asyncio
import time
import requests
import os
import sys

try:
    from pyquotex.stable_api import Quotex
    from pyquotex.utils.processor import process_candles
except ImportError:
    print("Error: pyquotex is not installed. Run: pip install pyquotex")
    sys.exit(1)

# Configure your credentials here or via environment variables
SSID = os.environ.get("QUOTEX_SSID", "")

WEBHOOK_URL = "http://localhost:5000/api/webhook/tick"

# List of OTC pairs to monitor
TARGET_PAIRS = [
    "EUR/USD (OTC)", "GBP/USD (OTC)", "USD/JPY (OTC)", 
    "USD/BRL (OTC)", "AUD/CAD (OTC)"
]

async def monitor_asset(client, asset):
    period = 60 # 1 minute candles
    offset = 60 # fetch last 60 seconds
    
    while True:
        try:
            end_time = time.time()
            candles = await client.get_candles(asset, end_time, offset, period)
            
            if len(candles) > 0:
                # Some versions of pyquotex return raw dicts that need processing
                if not candles[0].get("open"):
                    candles = process_candles(candles, period)
                
                # Get the latest candle
                latest = candles[-1]
                
                # Send to Node.js backend
                data = {
                    "pair": asset,
                    "price": latest.get("close"),
                    "timestamp": latest.get("time") * 1000 # Convert to ms
                }
                
                try:
                    requests.post(WEBHOOK_URL, json=data, timeout=1)
                except requests.exceptions.RequestException:
                    pass
            
        except Exception as e:
            print(f"Error fetching {asset}: {e}")
            
        await asyncio.sleep(1) # Poll every 1 second

async def main():
    if not SSID:
        print("Error: SSID is required to bypass Cloudflare block.")
        return

    print("Connecting to Quotex using SSID...")
    client = Quotex(email="dummy@email.com", password="dummy")
    
    # Inject SSID to bypass login
    client.api.session_data["token"] = SSID
    client.api.state.SSID = SSID
    
    # Directly connect to WS since we have the session
    connected, message = await client.connect()
    
    if not connected:
        print(f"Failed to connect: {message}")
        return
        
    print("Successfully connected to Quotex!")
    
    tasks = []
    for asset in TARGET_PAIRS:
        print(f"Starting monitor for {asset}...")
        tasks.append(asyncio.create_task(monitor_asset(client, asset)))
        
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
