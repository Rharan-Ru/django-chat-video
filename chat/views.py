from django.shortcuts import render
from django.views import View


class MainView(View):
    def get(self, request):
        return render(request, 'chat/main.html')
