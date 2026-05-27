import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
from apps.leads.models import Lead
from apps.businesses.models import Business
from .tasks import generate_ai_reply_task
from .throttling import WidgetRateThrottle

logger = logging.getLogger(__name__)

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer

    def get_permissions(self):
        if self.action in ['widget_start', 'widget_message', 'widget_poll']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_throttles(self):
        if self.action in ['widget_start', 'widget_message', 'widget_poll']:
            return [WidgetRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Conversation.objects.all()
        if self.request.user.business:
            return Conversation.objects.filter(business=self.request.user.business)
        return Conversation.objects.none()

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        messages = conversation.messages.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        conversation = self.get_object()
        content = request.data.get('content')
        
        if not content:
            return Response({"detail": "Content is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        message = Message.objects.create(
            conversation=conversation,
            sender_type='HUMAN',
            content=content
        )
        
        conversation.status = 'HUMAN_HANDOFF'
        conversation.save()
        
        if conversation.channel == 'SMS':
            from .tasks import send_sms_task
            send_sms_task.delay(
                to_number=conversation.lead.phone,
                from_number=conversation.business.phone_number,
                body=content
            )
            
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def takeover(self, request, pk=None):
        conversation = self.get_object()
        conversation.status = 'HUMAN_HANDOFF'
        conversation.save()
        return Response({"status": conversation.status})

    @action(detail=True, methods=['post'])
    def resume_ai(self, request, pk=None):
        conversation = self.get_object()
        conversation.status = 'AI_ACTIVE'
        conversation.save()
        return Response({"status": conversation.status})

    # ==========================================
    # OBSERVABILITY & DEBUG ENDPOINTS
    # ==========================================

    @action(detail=False, methods=['get'], url_path='failed-tasks')
    def failed_tasks(self, request):
        """
        Observability Endpoint: Lists failed message/SMS background dispatches
        with recorded error details for debugging.
        """
        # Filter by tenant if not superuser
        if self.request.user.is_superuser:
            failed_msgs = Message.objects.filter(delivery_status='failed')
        else:
            failed_msgs = Message.objects.filter(
                conversation__business=self.request.user.business,
                delivery_status='failed'
            )
            
        data = []
        for msg in failed_msgs:
            data.append({
                "message_id": str(msg.id),
                "conversation_id": str(msg.conversation.id),
                "lead_phone": msg.conversation.lead.phone,
                "error_message": msg.error_message,
                "timestamp": msg.created_at.isoformat()
            })
        return Response(data)

    @action(detail=True, methods=['get'], url_path='audit')
    def audit(self, request, pk=None):
        """
        Observability Endpoint: Inspects the conversation's state machine,
        AI extraction details, and confidence levels.
        """
        conversation = self.get_object()
        lead = conversation.lead
        
        return Response({
            "conversation_id": str(conversation.id),
            "current_state": conversation.state,
            "current_status": conversation.status,
            "last_ai_confidence": conversation.last_ai_confidence,
            "lead_priority_score": lead.priority_score,
            "lead_urgency": lead.urgency,
            "total_messages": conversation.messages.count(),
            "total_activities": lead.activities.count(),
            "extracted_details": {
                "name": lead.name,
                "phone": lead.phone,
                "email": lead.email,
                "address": lead.address,
                "roof_issue": lead.roof_issue,
                "preferred_inspection_time": lead.preferred_inspection_time
            }
        })

    @action(detail=True, methods=['get'], url_path='replay')
    def replay(self, request, pk=None):
        """
        Observability Endpoint: Outputs a chronological debug transcript.
        """
        conversation = self.get_object()
        messages = conversation.messages.all().order_by('created_at')
        
        transcript = []
        for msg in messages:
            transcript.append({
                "timestamp": msg.created_at.isoformat(),
                "sender": msg.sender_type,
                "text": msg.content,
                "provider_id": msg.provider_message_id,
                "delivery_status": msg.delivery_status
            })
            
        return Response({
            "conversation_id": str(conversation.id),
            "lead_phone": conversation.lead.phone,
            "channel": conversation.channel,
            "transcript": transcript
        })

    # ==========================================
    # PUBLIC WIDGET ENDPOINTS
    # ==========================================

    @action(detail=False, methods=['post'], url_path='widget/start')
    def widget_start(self, request):
        business_id = request.data.get('business_id')
        phone = request.data.get('phone', '')
        email = request.data.get('email', '')
        name = request.data.get('name', 'Website Guest')
        
        if not business_id:
            return Response({"detail": "business_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            business = Business.objects.get(id=business_id)
        except (Business.DoesNotExist, ValueError):
            return Response({"detail": "Invalid business ID."}, status=status.HTTP_404_NOT_FOUND)
            
        lead = None
        if phone:
            lead = Lead.objects.filter(business=business, phone=phone).first()
            
        if not lead:
            lead = Lead.objects.create(
                business=business,
                name=name,
                phone=phone or f"web_widget_{uuid_suffix()}",
                email=email,
                source='WEBSITE',
                status='NEW'
            )
            
        conversation = Conversation.objects.create(
            business=business,
            lead=lead,
            channel='WEB_CHAT',
            status='AI_ACTIVE',
            state='NEW'
        )
        
        welcome_text = f"Hi! Thanks for visiting {business.company_name}. How can we help you with your roofing needs today? (Roof repair, leak inspection, or full replacement?)"
        Message.objects.create(
            conversation=conversation,
            sender_type='AI',
            content=welcome_text
        )
        
        return Response({
            "conversation_id": str(conversation.id),
            "business_name": business.company_name,
            "primary_color": business.primary_color,
            "messages": MessageSerializer(conversation.messages.all(), many=True).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='widget/message')
    def widget_message(self, request):
        conversation_id = request.data.get('conversation_id')
        content = request.data.get('content')
        
        if not conversation_id or not content:
            return Response({"detail": "conversation_id and content are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except (Conversation.DoesNotExist, ValueError):
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
            
        message = Message.objects.create(
            conversation=conversation,
            sender_type='LEAD',
            content=content
        )
        
        lead = conversation.lead
        if lead.name == 'Website Guest' and request.data.get('name'):
            lead.name = request.data.get('name')
            lead.save()
            
        if conversation.status == 'AI_ACTIVE':
            generate_ai_reply_task.delay(str(conversation.id))
            
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='widget/poll')
    def widget_poll(self, request):
        conversation_id = request.query_params.get('conversation_id')
        last_count = request.query_params.get('last_message_count', '0')
        
        if not conversation_id:
            return Response({"detail": "conversation_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            conversation = Conversation.objects.get(id=conversation_id)
            last_count = int(last_count)
        except (Conversation.DoesNotExist, ValueError):
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
            
        messages = conversation.messages.all()
        if len(messages) > last_count:
            new_messages = messages[last_count:]
            return Response({
                "status": conversation.status,
                "messages": MessageSerializer(new_messages, many=True).data,
                "total_count": len(messages)
            })
            
        return Response({
            "status": conversation.status,
            "messages": [],
            "total_count": len(messages)
        })

def uuid_suffix():
    import uuid
    return str(uuid.uuid4())[:8]
