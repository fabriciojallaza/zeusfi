"""
Yields URL patterns.

/api/v1/yields/
"""

from django.urls import path
from .views import YieldPoolListView, YieldPoolDetailView, BestYieldsView

urlpatterns = [
    path("", YieldPoolListView.as_view(), name="yield-list"),
    path("best/", BestYieldsView.as_view(), name="yield-best"),
    path("<str:pool_id>/", YieldPoolDetailView.as_view(), name="yield-detail"),
]
