from rest_framework.throttling import SimpleRateThrottle

class WidgetRateThrottle(SimpleRateThrottle):
    """
    Limits the frequency of calls from anonymous website chatbot widgets.
    """
    scope = 'widget'
    rate = '30/minute'

    def get_cache_key(self, request, view):
        # Throttle by client IP for anon widget requests
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request)
        }


class TwilioWebhookRateThrottle(SimpleRateThrottle):
    """
    Limits webhook post-backs to avoid spam / denial-of-service issues.
    """
    scope = 'twilio'
    rate = '120/minute'

    def get_cache_key(self, request, view):
        # Throttle Twilio calls using client IP
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request)
        }
