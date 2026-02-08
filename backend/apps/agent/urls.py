from django.urls import path
from .views import AgentTriggerView, AgentStatusView, AgentUnwindView, AgentTestRebalanceView

urlpatterns = [
    path("trigger/", AgentTriggerView.as_view(), name="agent-trigger"),
    path("status/", AgentStatusView.as_view(), name="agent-status"),
    path("unwind/", AgentUnwindView.as_view(), name="agent-unwind"),
    path(
        "test-rebalance/", AgentTestRebalanceView.as_view(), name="agent-test-rebalance"
    ),
]
