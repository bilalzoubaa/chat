import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth.hashers import make_password, check_password
from .models import Room


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Extract room identifier from URL and username/password from querystring
        room_identifier = self.scope['url_route']['kwargs']['room_name']
        query_string = self.scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        self.username = (params.get('username', ["Anonyme"]) or ["Anonyme"])[0]
        password = (params.get('password', [""]) or [""])[0]
        create_flag = (params.get('create', ["0"]) or ["0"])[0] in ("1", "true", "True")

        # Resolve or create room
        room = await self._get_room(room_identifier)
        if room is None:
            if create_flag and password:
                room = await self._create_room(room_identifier, password)
            else:
                await self.close(code=4000)
                return
        else:
            # Check password
            if not password or not await self._check(room, password):
                await self.close(code=4001)
                return

        # Use room name as group key for compatibility
        self.room_name = room.name
        self.room_group_name = f"chat_{self.room_name}"

        # Join room group and accept
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Notify join (optional)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat.message',
                'message': f"{self.username} a rejoint la salle",
                'username': 'système'
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        # Notify leave (optional)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat.message',
                'message': f"{self.username} a quitté la salle",
                'username': 'système'
            }
        )

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                data = json.loads(text_data)
                message = data.get('message', '')
                username = data.get('username', self.username)
            except Exception:
                message = text_data
                username = self.username

            # Broadcast message to the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat.message',
                    'message': message,
                    'username': username,
                }
            )

    async def chat_message(self, event):
        # Send message to WebSocket as JSON
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'username': event.get('username', 'Anonyme')
        }))

    # Database helpers
    async def _get_room(self, identifier: str):
        async def _inner():
            if identifier.isdigit():
                try:
                    return await sync_to_async(Room.objects.get)(id=int(identifier))
                except Room.DoesNotExist:
                    return None
            try:
                return await sync_to_async(Room.objects.get)(name=identifier)
            except Room.DoesNotExist:
                return None
        return await _inner()

    async def _create_room(self, name: str, password: str):
        async def _inner():
            return await sync_to_async(Room.objects.create)(name=name, password_hash=make_password(password))
        return await _inner()

    async def _check(self, room: Room, password: str):
        return await sync_to_async(check_password)(password, room.password_hash)