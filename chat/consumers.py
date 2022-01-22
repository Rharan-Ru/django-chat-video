import json
from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'Chat-Room'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def receive(self, text_data=None, bytes_data=None):
        receive_dict = json.loads(text_data)

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

    async def send_sdp(self, event):
        receive_dict = event['receive_dict']
        print(receive_dict)
        await self.send(json.dumps({
            'receive_dict': receive_dict
        }))

    async def send_chat_msg(self, event):
        msg = event['msg']
        username = event['username']
        await self.send(json.dumps({
            'msg': msg,
            'username': username,
        }))
