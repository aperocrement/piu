#!/usr/bin/env python3
"""Piu WebSocket relay server — WiFi 双机联机"""

import asyncio
import websockets
import json
import random
import time

rooms = {}

def make_code():
    return ''.join(str(random.randint(0,9)) for _ in range(4))

async def safe_send(ws, data):
    """Send without blocking the handler, ignore if queue full."""
    try:
        await ws.send(data)
    except:
        pass

def fire_and_forget(coro):
    """Schedule a coroutine without awaiting it."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except:
        pass

async def handler(ws):
    room = None
    player = None

    try:
        async for raw in ws:
            msg = json.loads(raw)
            action = msg.get('action')

            if action == 'create':
                code = make_code()
                while code in rooms:
                    code = make_code()
                rooms[code] = {
                    'players': [{'ws': ws, 'player': 1}],
                    'created': time.time(),
                }
                room = code
                player = 1
                await ws.send(json.dumps({
                    'type': 'room_created', 'code': code, 'player': 1
                }))
                print(f'Room {code} created')

            elif action == 'join':
                code = msg.get('code', '').strip()
                if code not in rooms:
                    await ws.send(json.dumps({'type': 'error', 'msg': '房间不存在'}))
                    continue
                r = rooms[code]
                if len(r['players']) >= 2:
                    await ws.send(json.dumps({'type': 'error', 'msg': '房间已满'}))
                    continue
                r['players'].append({'ws': ws, 'player': 2})
                room = code
                player = 2
                await ws.send(json.dumps({
                    'type': 'joined', 'code': code, 'player': 2
                }))
                # Notify host
                fire_and_forget(safe_send(
                    r['players'][0]['ws'],
                    json.dumps({'type': 'opponent_joined'})
                ))
                print(f'Player 2 joined room {code}')

            elif action in ('relay', 'sync') and room:
                r = rooms.get(room)
                if not r:
                    continue
                payload = json.dumps({
                    'type': action if action == 'relay' else 'sync',
                    'from': player,
                    'data' if action == 'relay' else 'state': msg.get('data' if action == 'relay' else 'state', {}),
                })
                for p in r['players']:
                    if p['player'] != player:
                        fire_and_forget(safe_send(p['ws'], payload))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if room and room in rooms:
            r = rooms[room]
            r['players'] = [p for p in r['players'] if p['ws'] != ws]
            if not r['players']:
                del rooms[room]
                print(f'Room {room} closed')
            else:
                fire_and_forget(safe_send(
                    r['players'][0]['ws'],
                    json.dumps({'type': 'opponent_left'})
                ))
                print(f'Player left room {room}')

async def main():
    print('Piu WS Server started on ws://0.0.0.0:8765')
    async with websockets.serve(handler, '0.0.0.0', 8765):
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
