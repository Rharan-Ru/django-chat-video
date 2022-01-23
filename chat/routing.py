from django.urls import re_path
from . import consumers


# Routing Consumers
websocket_urlpatterns = [
    re_path(r'', consumers.ChatConsumer.as_asgi()),
]
