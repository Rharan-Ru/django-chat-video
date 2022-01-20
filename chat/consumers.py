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
        message = receive_dict['message']
        action = receive_dict['action']

        if action == 'new-offer' or action == 'new-answer':
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
        print(receive_dict)
        # peer_message = text_data_json['peer-message']
        # print(peer_message)
        # message = text_data_json['message']
        # print(message)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_sdp',
                'receive_dict': receive_dict,
            }
        )

    async def send_sdp(self, event):
        receive_dict = event['receive_dict']
        await self.send(json.dumps({
            'receive_dict': receive_dict
        }))
