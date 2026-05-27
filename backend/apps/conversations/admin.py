from django.contrib import admin
from .models import Conversation, Message

class MessageInline(admin.TabularInline):
    model = Message
    extra = 0

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('lead', 'channel', 'status', 'created_at')
    list_filter = ('channel', 'status', 'business')
    inlines = [MessageInline]
    search_fields = ('lead__name', 'lead__phone')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender_type', 'content', 'created_at')
    list_filter = ('sender_type',)
    search_fields = ('content',)
