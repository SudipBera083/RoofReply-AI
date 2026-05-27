import logging
from django.conf import settings
from twilio.rest import Client
from twilio.request_validator import RequestValidator

logger = logging.getLogger(__name__)

def validate_twilio_signature(request):
    """
    Validates that a request came from Twilio.
    Bypasses validation if settings.DEBUG is True or TWILIO_AUTH_TOKEN is not configured.
    """
    # 1. Fetch Twilio Auth Token
    auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    if settings.DEBUG or not auth_token:
        logger.warning("Twilio signature validation bypassed (DEBUG=True or token not set).")
        return True

    # 2. Get Twilio Signature Header
    signature = request.META.get('HTTP_X_TWILIO_SIGNATURE', '')
    if not signature:
        logger.error("X-Twilio-Signature header is missing.")
        return False

    # 3. Construct URL as Twilio expects it (handling proxies / ports)
    # Twilio validators require the exact protocol, domain, and path matching the webhook configuration.
    url = request.build_absolute_uri()
    
    # 4. Extract POST variables
    data = request.POST.dict()

    # 5. Execute validation
    validator = RequestValidator(auth_token)
    is_valid = validator.validate(url, data, signature)
    
    if not is_valid:
        logger.error(f"Twilio signature validation failed. URL: {url}, Data: {data}, Signature: {signature}")
    return is_valid


def send_sms_via_twilio(to_number, from_number, body, status_callback=None):
    """
    Dispatches an SMS message using the Twilio client.
    If Twilio credentials are not configured, falls back to mock log simulation.
    """
    account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    sender_number = from_number or getattr(settings, 'TWILIO_NUMBER', '+15555555555')

    if not account_sid or not auth_token:
        # Sandbox / Mock fallback mode
        import uuid
        mock_sid = f"SMmock_{uuid.uuid4().hex[:32]}"
        logger.info(f"[MOCK TWILIO SMS DISPATCH] SID: {mock_sid} | From: {sender_number} | To: {to_number} | Body: {body}")
        return mock_sid

    client = Client(account_sid, auth_token)
    
    # Configure callback URL for delivery status updates if provided
    kwargs = {
        'body': body,
        'from_': sender_number,
        'to': to_number
    }
    if status_callback:
        kwargs['status_callback'] = status_callback

    try:
        message = client.messages.create(**kwargs)
        logger.info(f"Twilio SMS dispatched. SID: {message.sid} | To: {to_number}")
        return message.sid
    except Exception as e:
        logger.error(f"Twilio API error sending message to {to_number}: {str(e)}")
        raise e
