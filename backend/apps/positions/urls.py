"""
Positions URL patterns.

/api/v1/positions/
"""

from django.urls import path
from .views import (
    PositionsView,
    RebalanceHistoryView,
    RebalanceDetailView,
    QuoteView,
    ExecuteRebalanceView,
)

urlpatterns = [
    # Put specific routes before parameterized routes
    path("quote/", QuoteView.as_view(), name="quote"),
    path("rebalance/", ExecuteRebalanceView.as_view(), name="execute-rebalance"),
    path("<str:address>/", PositionsView.as_view(), name="positions-detail"),
    path("<str:address>/history/", RebalanceHistoryView.as_view(), name="rebalance-history"),
    path(
        "<str:address>/history/<int:rebalance_id>/",
        RebalanceDetailView.as_view(),
        name="rebalance-detail",
    ),
]
