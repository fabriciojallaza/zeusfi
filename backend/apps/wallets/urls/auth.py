"""
Auth URL patterns.

/api/v1/auth/
"""

from django.urls import path
from apps.wallets.views import NonceView, VerifyView

urlpatterns = [
    path("nonce/", NonceView.as_view(), name="auth-nonce"),
    path("verify/", VerifyView.as_view(), name="auth-verify"),
]
