import os
import json
import logging
from django.conf import settings
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import Optional
from apps.businesses.models import Business, KnowledgeBase
from .models import Conversation, Message

logger = logging.getLogger(__name__)

class AILeadExtraction(BaseModel):
    reply: str = Field(description="The natural response message to send to the roofing customer.")
    customer_name: Optional[str] = Field(default=None, description="Extracted customer name if mentioned.")
    address: Optional[str] = Field(default=None, description="Extracted physical property address if mentioned.")
    roof_issue: Optional[str] = Field(default=None, description="Description of the roofing issue.")
    urgency: str = Field(default="STANDARD_ESTIMATE", description="Urgency: IMMEDIATE_LEAK, ACTIVE_STORM_DAMAGE, EMERGENCY_TARP_REQUIRED, STANDARD_ESTIMATE, PLANNING")
    priority_score: int = Field(default=50, description="Lead priority score between 1 and 100.")
    preferred_inspection_time: Optional[str] = Field(default=None, description="A date, day, or time slot they prefer for their inspection.")
    insurance_involvement: bool = Field(default=False, description="Whether they mention insurance coverage/claims.")
    storm_damage_mention: bool = Field(default=False, description="Whether they mention wind, hail, storm or tree damage.")
    escalate_to_human: bool = Field(default=False, description="True if customer is angry, mentions lawsuit, asks for cancellation, or AI confidence is low.")
    confidence_score: float = Field(default=1.0, description="Confidence rating between 0.0 and 1.0 of the extraction accuracy.")
    next_state: str = Field(default="QUALIFYING", description="NEW, QUALIFYING, WAITING_FOR_ADDRESS, WAITING_FOR_INSPECTION_TIME, BOOKING_REQUESTED, HUMAN_HANDOFF, CLOSED")


def query_openai_qualification(conversation: Conversation) -> AILeadExtraction:
    """
    Queries OpenAI for structured lead details, generating the reply and confidence.
    """
    api_key = getattr(settings, 'OPENAI_API_KEY', '')
    business = conversation.business
    lead = conversation.lead
    
    kb_items = KnowledgeBase.objects.filter(business=business, active=True)
    kb_text = "\n".join([f"Q: {k.question}\nA: {k.answer}" for k in kb_items])
    
    messages_query = conversation.messages.all()[:10]
    chat_history = []
    for msg in reversed(messages_query):
        role = "assistant" if msg.sender_type in ['AI', 'HUMAN'] else "user"
        chat_history.append({"role": role, "content": msg.content})

    system_prompt = f"""You are a friendly, highly professional office coordinator for {business.company_name}.
Your job is to qualify roofing leads over text message and collect details for an inspection estimate.
Be concise, practical, and direct.

Current Lead details collected so far:
- Name: {lead.name or "Not collected yet"}
- Address: {lead.address or "Not collected yet"}
- Roof Issue: {lead.roof_issue or "Not collected yet"}
- Preferred time: {lead.preferred_inspection_time or "Not collected yet"}
- Urgency: {lead.urgency}
- Current State: {conversation.state}

Business FAQs:
{kb_text}

Rules:
1. Write 'reply'.
2. Extract customer details.
3. Classify Urgency (IMMEDIATE_LEAK, ACTIVE_STORM_DAMAGE, EMERGENCY_TARP_REQUIRED, STANDARD_ESTIMATE, PLANNING) and priority_score (1-100).
4. Evaluate a confidence_score (float 0.0 - 1.0). If the customer is repeatedly confused or asking out-of-scope questions, reduce confidence below 0.6.
5. If customer is angry, mentions lawsuits/cancellation, or confidence is low, escalate to human takeover (set escalate_to_human=true and next_state='HUMAN_HANDOFF').
"""

    if not api_key:
        return _execute_fallback_heuristics(conversation, chat_history)

    try:
        client = OpenAI(api_key=api_key)
        full_messages = [{"role": "system", "content": system_prompt}] + chat_history
        
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=full_messages,
            response_format=AILeadExtraction,
            max_tokens=400,
            temperature=0.2
        )
        
        extracted_data = completion.choices[0].message.parsed
        if not extracted_data:
            raise ValueError("Parsed output was null.")
            
        logger.info(f"OpenAI parse for Conv {conversation.id}: confidence={extracted_data.confidence_score}, state={extracted_data.next_state}")
        return extracted_data

    except Exception as e:
        logger.error(f"OpenAI API failed: {str(e)}. Running heuristics.")
        return _execute_fallback_heuristics(conversation, chat_history)


def _execute_fallback_heuristics(conversation: Conversation, chat_history: list) -> AILeadExtraction:
    """
    Rule-based fallback processor mapping text inputs to structured responses and confidence logs.
    """
    last_message = chat_history[-1]["content"] if chat_history else ""
    last_message_lower = last_message.lower()

    customer_name = conversation.lead.name
    address = conversation.lead.address
    roof_issue = conversation.lead.roof_issue or last_message
    urgency = conversation.lead.urgency
    priority_score = conversation.lead.priority_score
    preferred_time = conversation.lead.preferred_inspection_time
    insurance = False
    storm = False
    escalate = False
    confidence_score = 1.0
    next_state = conversation.state

    # Confusion / low confidence trigger mock
    confusion_keywords = ["what do you mean", "who is this", "are you human", "are you a bot", "not making sense", "not understand"]
    if any(kw in last_message_lower for kw in confusion_keywords):
        confidence_score = 0.5
        escalate = True
        next_state = "HUMAN_HANDOFF"

    # Anger / lawsuit trigger mock
    escalation_keywords = ["angry", "lawsuit", "sue", "cancel", "dispute", "court", "complaint", "scam"]
    if any(kw in last_message_lower for kw in escalation_keywords):
        escalate = True
        next_state = "HUMAN_HANDOFF"

    # Urgencies
    if any(kw in last_message_lower for kw in ["active leak", "dripping", "water coming in", "ceiling"]):
        urgency = "IMMEDIATE_LEAK"
        priority_score = 95
    elif any(kw in last_message_lower for kw in ["storm", "wind", "hail", "tree fell"]):
        urgency = "ACTIVE_STORM_DAMAGE"
        priority_score = 85
        storm = True
    elif any(kw in last_message_lower for kw in ["tarp", "exposure", "hole in roof"]):
        urgency = "EMERGENCY_TARP_REQUIRED"
        priority_score = 90

    # Extractions
    if "my name is" in last_message_lower:
        idx = last_message_lower.find("my name is") + len("my name is ")
        customer_name = last_message[idx:].strip().split(".")[0].strip()
    elif "name:" in last_message_lower:
        idx = last_message_lower.find("name:") + len("name:")
        customer_name = last_message[idx:].strip().split("\n")[0].strip()

    if "address is" in last_message_lower:
        idx = last_message_lower.find("address is") + len("address is ")
        address = last_message[idx:].strip().split(".")[0].strip()
    elif "address:" in last_message_lower:
        idx = last_message_lower.find("address:") + len("address:")
        address = last_message[idx:].strip().split("\n")[0].strip()

    if "insurance" in last_message_lower:
        insurance = True

    if any(kw in last_message_lower for kw in ["morning", "afternoon", "tomorrow", "time:", "schedule"]):
        preferred_time = last_message
        next_state = "BOOKING_REQUESTED"

    # Transitions
    if next_state == "NEW" or next_state == "NEW_CONVERSATION":
        next_state = "QUALIFYING"
        
    if next_state == "QUALIFYING":
        if not address:
            next_state = "WAITING_FOR_ADDRESS"
        elif not preferred_time:
            next_state = "WAITING_FOR_INSPECTION_TIME"
        else:
            next_state = "BOOKING_REQUESTED"
            
    elif next_state == "WAITING_FOR_ADDRESS" and address:
        next_state = "WAITING_FOR_INSPECTION_TIME" if not preferred_time else "BOOKING_REQUESTED"
        
    elif next_state == "WAITING_FOR_INSPECTION_TIME" and preferred_time:
        next_state = "BOOKING_REQUESTED"

    if escalate:
        next_state = "HUMAN_HANDOFF"

    # Response generation
    if next_state == "HUMAN_HANDOFF":
        if confidence_score < 0.6:
            reply = "I'm sorry for any confusion. I am pulling one of our office estimators into this chat right now to help you directly."
        else:
            reply = "I understand. I am pausing our automated system and routing your message directly to our manager."
    elif next_state == "WAITING_FOR_ADDRESS":
        reply = "Got it. What is the physical address of the property that needs the roof estimate?"
    elif next_state == "WAITING_FOR_INSPECTION_TIME":
        reply = "Thanks! When is the best time for our estimator to come do a roof inspection? (Mornings or afternoons?)"
    elif next_state == "BOOKING_REQUESTED":
        reply = "Perfect. I've requested a roof estimate booking for you. Our office will call you shortly to confirm the slot."
    else:
        reply = "Could you tell us more about the roofing issue you are experiencing?"

    return AILeadExtraction(
        reply=reply,
        customer_name=customer_name,
        address=address,
        roof_issue=roof_issue,
        urgency=urgency,
        priority_score=priority_score,
        preferred_inspection_time=preferred_time,
        insurance_involvement=insurance,
        storm_damage_mention=storm,
        escalate_to_human=escalate,
        confidence_score=confidence_score,
        next_state=next_state
    )
