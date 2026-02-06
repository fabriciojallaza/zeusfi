"""
Views for yields API.
"""

from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallets.authentication import JWTAuthentication
from .models import YieldPool
from .serializers import YieldPoolSerializer


class YieldPoolListView(APIView):
    """
    List yield pools with filtering.

    GET /api/v1/yields/

    Query params:
        chain: Filter by chain name (base, arbitrum, avalanche)
        chain_id: Filter by chain ID
        project: Filter by protocol (aave-v3, morpho-v1, euler-v2)
        min_apy: Minimum APY
        max_risk: Maximum risk score (1-10)
        min_tvl: Minimum TVL in USD
        best: If true, apply user's ENS preferences and return best per chain
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        queryset = YieldPool.objects.all()
        wallet = request.user

        # Check if best mode (apply user preferences)
        best_mode = request.query_params.get("best", "").lower() in ("true", "1", "yes")

        if best_mode:
            # Apply user's ENS preferences
            if wallet.ens_chains:
                queryset = queryset.filter(chain__in=wallet.ens_chains)

            if wallet.ens_protocols:
                from config.protocols import map_ens_protocols

                mapped = map_ens_protocols(wallet.ens_protocols)
                if mapped:
                    queryset = queryset.filter(project__in=mapped)

            if wallet.ens_min_apy:
                queryset = queryset.filter(apy__gte=wallet.ens_min_apy)

            if wallet.ens_max_risk:
                risk_map = {"low": 3, "medium": 6, "high": 10}
                max_risk_score = risk_map.get(wallet.ens_max_risk, 10)
                queryset = queryset.filter(risk_score__lte=max_risk_score)

        # Apply explicit filters (override preferences if provided)
        chain = request.query_params.get("chain")
        if chain:
            queryset = queryset.filter(chain__iexact=chain)

        chain_id = request.query_params.get("chain_id")
        if chain_id:
            queryset = queryset.filter(chain_id=chain_id)

        project = request.query_params.get("project")
        if project:
            queryset = queryset.filter(project__iexact=project)

        symbol = request.query_params.get("symbol")
        if symbol:
            queryset = queryset.filter(symbol__icontains=symbol)

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

        # In best mode, return only best per chain
        if best_mode:
            from config.chains import SUPPORTED_CHAINS

            best_pools = []
            for cid in SUPPORTED_CHAINS.keys():
                best_pool = queryset.filter(chain_id=cid).first()
                if best_pool:
                    best_pools.append(best_pool)

            serializer = YieldPoolSerializer(best_pools, many=True)
            return Response(
                {
                    "pools": serializer.data,
                    "mode": "best",
                    "preferences_applied": {
                        "chains": wallet.ens_chains or "all",
                        "protocols": wallet.ens_protocols or "all",
                        "min_apy": str(wallet.ens_min_apy)
                        if wallet.ens_min_apy
                        else None,
                        "max_risk": wallet.ens_max_risk,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # Normal mode - return all matching pools
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

        serializer = YieldPoolSerializer(pool)
        return Response(serializer.data, status=status.HTTP_200_OK)
