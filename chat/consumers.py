import json
from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Chat consumer for chat-app and send WebRTC Signnals
    """
    async def connect(self):
        # Just connect in chat-room
        self.room_group_name = 'Chat-Room'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, code):
        # Disconnect from chat-room
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def receive(self, text_data=None, bytes_data=None):
        # Data received from websocket
        receive_dict = json.loads(text_data)

        # Send messages to channel layer group for all users communication
        if 'chat-msg' in receive_dict:
            print(receive_dict['username'])
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'send_chat_msg',
                    'msg': receive_dict['chat-msg'],
                    'username': receive_dict['username'],
                }
            )
            return

        action = receive_dict['action']

        # If new-offer or new-answer send signnals to user create a new connection in ice-server
        if (action == 'new-offer') or (action == 'new-answer'):
            receiver_channel_name = receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name'] = self.channel_name
            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send_sdp',
                    'receive_dict': receive_dict,
                }
            )
            return

        receive_dict['message']['receiver_channel_name'] = self.channel_name
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_sdp',
                'receive_dict': receive_dict,
            }
        )

    # Send session description protocol
    async def send_sdp(self, event):
        receive_dict = event['receive_dict']
        print(receive_dict)
        await self.send(json.dumps({
            'receive_dict': receive_dict
        }))

    # Send messages from frontend-chat
    async def send_chat_msg(self, event):
        msg = event['msg']
        username = event['username']
        await self.send(json.dumps({
            'msg': msg,
            'username': username,
        }))
