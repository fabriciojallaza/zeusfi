"""
Views for yields API.
"""

from decimal import Decimal

from django_filters import rest_framework as filters
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallets.authentication import JWTAuthentication
from .models import YieldPool
from .serializers import YieldPoolSerializer, YieldPoolDetailSerializer


class YieldPoolFilter(filters.FilterSet):
    """Filter for yield pools."""

    chain = filters.CharFilter(field_name="chain", lookup_expr="iexact")
    chain_id = filters.NumberFilter(field_name="chain_id")
    project = filters.CharFilter(field_name="project", lookup_expr="iexact")
    min_apy = filters.NumberFilter(field_name="apy", lookup_expr="gte")
    max_risk = filters.NumberFilter(field_name="risk_score", lookup_expr="lte")
    min_tvl = filters.NumberFilter(field_name="tvl_usd", lookup_expr="gte")

    class Meta:
        model = YieldPool
        fields = ["chain", "chain_id", "project", "min_apy", "max_risk", "min_tvl"]


class YieldPoolListView(APIView):
    """
    List yield pools with filtering.

    GET /api/v1/yields/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        queryset = YieldPool.objects.all()

        # Apply filters
        chain = request.query_params.get("chain")
        if chain:
            queryset = queryset.filter(chain__iexact=chain)

        chain_id = request.query_params.get("chain_id")
        if chain_id:
            queryset = queryset.filter(chain_id=chain_id)

        project = request.query_params.get("project")
        if project:
            queryset = queryset.filter(project__iexact=project)

        min_apy = request.query_params.get("min_apy")
        if min_apy:
            queryset = queryset.filter(apy__gte=Decimal(min_apy))

        max_risk = request.query_params.get("max_risk")
        if max_risk:
            queryset = queryset.filter(risk_score__lte=int(max_risk))

        min_tvl = request.query_params.get("min_tvl")
        if min_tvl:
            queryset = queryset.filter(tvl_usd__gte=Decimal(min_tvl))

        # Order by APY descending
        queryset = queryset.order_by("-apy")

        serializer = YieldPoolSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class YieldPoolDetailView(APIView):
    """
    Get yield pool details.

    GET /api/v1/yields/{pool_id}/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pool_id: str) -> Response:
        try:
            pool = YieldPool.objects.get(pool_id=pool_id)
        except YieldPool.DoesNotExist:
            return Response(
                {"error": "Pool not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = YieldPoolDetailSerializer(pool)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BestYieldsView(APIView):
    """
    Get best yields per chain based on user preferences.

    GET /api/v1/yields/best/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        wallet = request.user

        # Build filter based on user's ENS preferences
        queryset = YieldPool.objects.all()

        # Filter by user's allowed chains
        if wallet.ens_chains:
            queryset = queryset.filter(chain__in=wallet.ens_chains)

        # Filter by user's allowed protocols
        if wallet.ens_protocols:
            queryset = queryset.filter(project__in=wallet.ens_protocols)

        # Filter by minimum APY
        if wallet.ens_min_apy:
            queryset = queryset.filter(apy__gte=wallet.ens_min_apy)

        # Filter by max risk
        if wallet.ens_max_risk:
            risk_map = {"low": 3, "medium": 6, "high": 10}
            max_risk_score = risk_map.get(wallet.ens_max_risk, 10)
            queryset = queryset.filter(risk_score__lte=max_risk_score)

        # Get best pool per chain
        from config.chains import SUPPORTED_CHAINS

        best_pools = []
        for chain_id in SUPPORTED_CHAINS.keys():
            best_pool = queryset.filter(chain_id=chain_id).order_by("-apy").first()
            if best_pool:
                best_pools.append(best_pool)

        serializer = YieldPoolSerializer(best_pools, many=True)
        return Response(
            {
                "pools": serializer.data,
                "preferences_applied": {
                    "chains": wallet.ens_chains or "all",
                    "protocols": wallet.ens_protocols or "all",
                    "min_apy": str(wallet.ens_min_apy) if wallet.ens_min_apy else None,
                    "max_risk": wallet.ens_max_risk,
                },
            },
            status=status.HTTP_200_OK,
        )
