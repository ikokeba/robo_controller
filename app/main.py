import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import logging
from app.robot_client import RobotClient

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("App")

app = FastAPI()

# Mount Static Files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Initialize Robot Client (Global for simplicity in this scope, or use dependency injection)
# NOTE: In a real prod app, manage connection lifecycle more robustly.
robot = RobotClient(host='127.0.0.1', port=9999) 

@app.on_event("startup")
async def startup_event():
    # Attempt initial connection
    await robot.connect()

@app.on_event("shutdown")
async def shutdown_event():
    await robot.disconnect()

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    status_task = None
    try:
        async def send_status_updates():
            last_state = None
            while True:
                await robot.refresh_connection_state()
                current_state = robot.connected
                if current_state != last_state:
                    await websocket.send_json({
                        "type": "status",
                        "data": {"robot_connected": current_state}
                    })
                    last_state = current_state
                await asyncio.sleep(1)

        status_task = asyncio.create_task(send_status_updates())
        while True:
            data = await websocket.receive_json()
            # Bridge WebSocket data to Robot TCP Client
            # Expected format from frontend: {"type": "move", "data": {...}} 
            
            action_type = data.get("type")
            payload = data.get("data", {})
            
            if action_type == "move":
                await robot.move(pan=payload.get("pan", 0), tilt=payload.get("tilt", 0))
            
            elif action_type == "face":
                await robot.change_expression(expression=payload.get("val"))
            
            elif action_type == "say":
                await robot.speak(text=payload.get("val"))

            elif action_type == "reconnect":
                await robot.reconnect()
                await websocket.send_json({
                    "type": "status",
                    "data": {"robot_connected": robot.connected}
                })
            
            # Echo back status if needed, or acknowledge
            # await websocket.send_text(f"Processed {action_type}")

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
    finally:
        if status_task:
            status_task.cancel()
