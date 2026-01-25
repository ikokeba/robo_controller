import asyncio
import json
import logging

class RobotClient:
    def __init__(self, host: str = '127.0.0.1', port: int = 9999):
        self.host = host
        self.port = port
        self.reader = None
        self.writer = None
        self.connected = False
        self.logger = logging.getLogger("RobotClient")

    async def connect(self):
        try:
            self.reader, self.writer = await asyncio.open_connection(self.host, self.port)
            self.connected = True
            self.logger.info(f"Connected to Robot at {self.host}:{self.port}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to robot: {e}")
            self.connected = False
            return False

    async def disconnect(self):
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()
            self.connected = False
            self.logger.info("Disconnected from Robot")

    async def send_command(self, cmd_type: str, **kwargs):
        if not self.connected:
            # Try reconnecting once
            if not await self.connect():
                self.logger.warning("Cannot send command: not connected")
                return

        command = {"cmd": cmd_type}
        command.update(kwargs)
        
        try:
            message = json.dumps(command) + "\n"
            self.writer.write(message.encode())
            await self.writer.drain()
            self.logger.debug(f"Sent: {message.strip()}")
        except Exception as e:
            self.logger.error(f"Error sending data: {e}")
            self.connected = False

    async def move(self, pan: float, tilt: float):
        await self.send_command("move", pan=pan, tilt=tilt)

    async def change_expression(self, expression: str):
        # map expression if needed, for now pass directly
        await self.send_command("face", val=expression)

    async def speak(self, text: str):
        await self.send_command("say", val=text)
