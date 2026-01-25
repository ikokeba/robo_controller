
import asyncio
import json

HOST = '127.0.0.1'
PORT = 9999

async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    print(f"Connected by {addr}")

    try:
        while True:
            data = await reader.readline()
            if not data:
                break
            
            message = data.decode().strip()
            print(f"Received: {message}")
            
            # Simple validation check
            try:
                cmd = json.loads(message)
                print(f"Parsed Command: {cmd}")
            except json.JSONDecodeError:
                print("Failed to decode JSON")

    except asyncio.CancelledError:
        pass
    finally:
        print(f"Closed connection from {addr}")
        writer.close()
        await writer.wait_closed()

async def main():
    server = await asyncio.start_server(handle_client, HOST, PORT)
    print(f"Mock Robot Server listening on {HOST}:{PORT}")
    
    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped")
