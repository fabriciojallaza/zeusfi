from django.urls import path
from .views import AgentTriggerView, AgentStatusView, AgentTestRebalanceView

urlpatterns = [
    path("trigger/", AgentTriggerView.as_view(), name="agent-trigger"),
    path("status/", AgentStatusView.as_view(), name="agent-status"),
    path(
        "test-rebalance/", AgentTestRebalanceView.as_view(), name="agent-test-rebalance"
    ),
]
