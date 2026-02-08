"""
Wallet URL patterns.

/api/v1/wallet/
"""

from django.urls import path
from apps.wallets.views import WalletDetailView, RegisterVaultView, WalletSettingsView

urlpatterns = [
    # Put specific routes before parameterized routes
    path("register-vault/", RegisterVaultView.as_view(), name="register-vault"),
    path("settings/", WalletSettingsView.as_view(), name="wallet-settings"),
    path("<str:address>/", WalletDetailView.as_view(), name="wallet-detail"),
]
