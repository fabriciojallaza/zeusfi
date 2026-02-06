"""
Views for positions API.
"""

import asyncio
import logging
from decimal import Decimal
from collections import defaultdict

from django.db import models as db_models
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallets.authentication import JWTAuthentication
from apps.wallets.models import Wallet, Vault
from .models import RebalanceHistory
from .serializers import (
    RebalanceHistorySerializer,
    QuoteRequestSerializer,
    QuoteResponseSerializer,
)

logger = logging.getLogger(__name__)


class PositionsView(APIView):
    """
    Get current positions for a wallet.

    GET /api/v1/positions/{address}/

    Reads positions directly from on-chain (not from database).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, address: str) -> Response:
        address = address.lower()

        # Users can only view their own positions
        if request.user.address != address:
            return Response(
                {"error": "Not authorized to view these positions"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            wallet = Wallet.objects.prefetch_related("vaults").get(address=address)
        except Wallet.DoesNotExist:
            return Response(
                {"error": "Wallet not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get active vaults
        vaults = wallet.vaults.filter(is_active=True)
        if not vaults.exists():
            return Response(
                {
                    "total_value_usd": "0",
                    "average_apy": "0",
                    "positions": [],
                    "by_chain": {},
                    "by_protocol": {},
                },
                status=status.HTTP_200_OK,
            )

        # Build vault addresses map
        vault_addresses = {v.chain_id: v.vault_address for v in vaults}

        # Read positions from chain
        try:
            positions = asyncio.run(self._read_positions(vault_addresses))
        except Exception as e:
            logger.error(f"Failed to read on-chain positions: {e}")
            return Response(
                {"error": f"Failed to read positions: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Enrich with APY from YieldPool cache
        from apps.yields.models import YieldPool
        from config.chains import CHAIN_ID_TO_NAME

        yield_pools = {
            (p.chain, p.project): p
            for p in YieldPool.objects.filter(symbol__icontains="USDC")
        }

        enriched_positions = []
        total_value_usd = Decimal("0")
        weighted_apy_sum = Decimal("0")

        by_chain = defaultdict(lambda: {"value_usd": Decimal("0")})
        by_protocol = defaultdict(lambda: {"value_usd": Decimal("0")})

        for pos in positions:
            chain_name = CHAIN_ID_TO_NAME.get(pos.chain_id, str(pos.chain_id))

            # Get APY from cached yield data
            pool = yield_pools.get((chain_name, pos.protocol))
            current_apy = Decimal(str(pool.apy)) if pool else Decimal("0")

            enriched = {
                "chain_id": pos.chain_id,
                "chain_name": chain_name,
                "protocol": pos.protocol,
                "token": pos.token,
                "amount": str(pos.amount),
                "amount_usd": str(pos.amount_usd),
                "current_apy": str(current_apy),
                "vault_token_address": pos.vault_token_address,
            }
            enriched_positions.append(enriched)

            total_value_usd += pos.amount_usd
            weighted_apy_sum += pos.amount_usd * current_apy
            by_chain[chain_name]["value_usd"] += pos.amount_usd
            by_protocol[pos.protocol]["value_usd"] += pos.amount_usd

        average_apy = (
            weighted_apy_sum / total_value_usd if total_value_usd > 0 else Decimal("0")
        )

        # Convert to strings for JSON
        by_chain_dict = {
            k: {"value_usd": str(v["value_usd"])} for k, v in by_chain.items()
        }
        by_protocol_dict = {
            k: {"value_usd": str(v["value_usd"])} for k, v in by_protocol.items()
        }

        return Response(
            {
                "total_value_usd": str(total_value_usd),
                "average_apy": str(average_apy),
                "positions": enriched_positions,
                "by_chain": by_chain_dict,
                "by_protocol": by_protocol_dict,
            },
            status=status.HTTP_200_OK,
        )

    async def _read_positions(self, vault_addresses: dict[int, str]) -> list:
        """Read positions from on-chain."""
        from integrations.contracts import ContractReader

        reader = ContractReader()
        return await reader.get_positions_all_chains(vault_addresses)


class RebalanceHistoryView(APIView):
    """
    Get rebalance history for a wallet.

    GET /api/v1/history/{address}/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, address: str) -> Response:
        address = address.lower()

        # Users can only view their own history
        if request.user.address != address:
            return Response(
                {"error": "Not authorized to view this history"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            wallet = Wallet.objects.get(address=address)
        except Wallet.DoesNotExist:
            return Response(
                {"error": "Wallet not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get history with optional filters
        history = RebalanceHistory.objects.filter(wallet=wallet)

        # Filter by status
        status_filter = request.query_params.get("status")
        if status_filter:
            history = history.filter(status=status_filter)

        # Filter by chain
        chain_id = request.query_params.get("chain_id")
        if chain_id:
            history = history.filter(
                db_models.Q(from_chain_id=chain_id) | db_models.Q(to_chain_id=chain_id)
            )

        # Pagination
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))
        history = history[offset : offset + limit]

        serializer = RebalanceHistorySerializer(history, many=True)

        return Response(
            {
                "history": serializer.data,
                "count": len(serializer.data),
                "limit": limit,
                "offset": offset,
            },
            status=status.HTTP_200_OK,
        )


class RebalanceDetailView(APIView):
    """
    Get details of a specific rebalance.

    GET /api/v1/history/{address}/{rebalance_id}/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, address: str, rebalance_id: int) -> Response:
        address = address.lower()

        # Users can only view their own history
        if request.user.address != address:
            return Response(
                {"error": "Not authorized to view this rebalance"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            rebalance = RebalanceHistory.objects.get(
                id=rebalance_id,
                wallet__address=address,
            )
        except RebalanceHistory.DoesNotExist:
            return Response(
                {"error": "Rebalance not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = RebalanceHistorySerializer(rebalance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuoteView(APIView):
    """
    Get LI.FI quote for cross-chain rebalance.

    POST /api/v1/positions/quote/
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = QuoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = request.user
        data = serializer.validated_data

        # Verify the vault belongs to the user
        vault_address = data["vault_address"]
        try:
            Vault.objects.get(
                wallet=wallet,
                vault_address=vault_address,
                is_active=True,
            )
        except Vault.DoesNotExist:
            return Response(
                {"error": "Vault not found or not owned by this wallet"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get quote from LI.FI
        try:
            quote = asyncio.run(self._get_quote(data))
        except Exception as e:
            logger.error(f"Failed to get LI.FI quote: {e}")
            return Response(
                {"error": f"Failed to get quote: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_serializer = QuoteResponseSerializer(quote)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    async def _get_quote(self, data: dict) -> dict:
        """Get quote from LI.FI."""
        from integrations.lifi import LiFiClient

        client = LiFiClient()
        async with client:
            quote = await client.get_quote(
                from_chain=data["from_chain"],
                from_token=data["from_token"],
                from_amount=data["from_amount"],
                to_chain=data["to_chain"],
                to_token=data["to_token"],
                from_address=data["vault_address"],
                slippage=data.get("slippage", 0.03),
            )

        return {
            "quote_id": quote.id,
            "type": quote.type,
            "tool": quote.tool,
            "is_cross_chain": quote.is_cross_chain,
            "from_chain": quote.action.fromChainId,
            "from_token": quote.action.fromToken.symbol,
            "from_amount": quote.estimate.fromAmount,
            "to_chain": quote.action.toChainId,
            "to_token": quote.action.toToken.symbol,
            "to_amount": quote.estimate.toAmount,
            "to_amount_min": quote.estimate.toAmountMin,
            "gas_cost_usd": str(quote.estimate.total_gas_usd),
            "execution_duration": quote.estimate.executionDuration,
            "transaction_request": {
                "to": quote.transactionRequest.to,
                "data": quote.transactionRequest.data,
                "value": quote.transactionRequest.value,
                "gas_limit": quote.transactionRequest.gasLimit,
                "chain_id": quote.transactionRequest.chainId,
            }
            if quote.transactionRequest
            else None,
        }


class ExecuteRebalanceView(APIView):
    """
    Execute a rebalance via LI.FI.

    POST /api/v1/positions/rebalance/

    This endpoint:
    1. Gets a LI.FI quote
    2. Executes the transaction (via Agent Wallet)
    3. Waits for completion
    4. Records in RebalanceHistory

    Note: This is typically called by the AI Agent, not directly by users.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        from .serializers import ExecuteRebalanceRequestSerializer

        serializer = ExecuteRebalanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = request.user
        data = serializer.validated_data

        # Verify source vault belongs to user
        try:
            from_vault = Vault.objects.get(
                wallet=wallet,
                chain_id=data["from_chain"],
                is_active=True,
            )
        except Vault.DoesNotExist:
            return Response(
                {"error": "Source vault not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get or create destination vault
        to_vault = None
        if data["from_chain"] != data["to_chain"]:
            to_vault = Vault.objects.filter(
                wallet=wallet,
                chain_id=data["to_chain"],
                is_active=True,
            ).first()

        # Create pending rebalance record
        rebalance = RebalanceHistory.objects.create(
            wallet=wallet,
            from_chain_id=data["from_chain"],
            from_protocol=data.get("from_protocol", ""),
            from_token=data.get("from_token_symbol", "USDC"),
            from_vault=from_vault,
            to_chain_id=data["to_chain"],
            to_protocol=data.get("to_protocol", ""),
            to_token=data.get("to_token_symbol", "USDC"),
            to_vault=to_vault,
            amount=Decimal(data["from_amount"]) / Decimal(10**6),  # Assuming 6 decimals
            amount_usd=Decimal(data["from_amount"]) / Decimal(10**6),  # 1:1 for USDC
            from_apy=data.get("from_apy"),
            to_apy=data.get("to_apy"),
            agent_reasoning=data.get("agent_reasoning"),
            status=RebalanceHistory.Status.PENDING,
        )

        # Execute in background or synchronously
        if data.get("async", False):
            # Queue for background execution
            from .tasks import execute_rebalance_task

            execute_rebalance_task.delay(rebalance.id, data)
            return Response(
                {
                    "rebalance_id": rebalance.id,
                    "status": "pending",
                    "message": "Rebalance queued for execution",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Synchronous execution
        try:
            result = asyncio.run(self._execute_rebalance(rebalance, data))
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Rebalance execution failed: {e}")
            rebalance.mark_failed(str(e))
            return Response(
                {"error": f"Rebalance failed: {str(e)}", "rebalance_id": rebalance.id},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    async def _execute_rebalance(self, rebalance: RebalanceHistory, data: dict) -> dict:
        """Execute the rebalance via LI.FI."""
        from integrations.lifi import LiFiExecutor, LiFiExecutionError

        executor = LiFiExecutor()

        try:
            # Execute full LI.FI flow
            result = await executor.execute_full_flow(
                from_chain=data["from_chain"],
                from_token=data["from_token"],
                from_amount=data["from_amount"],
                to_chain=data["to_chain"],
                to_token=data["to_token"],
                from_address=data["vault_address"],
                slippage=data.get("slippage", 0.03),
            )

            # Update rebalance record
            rebalance.tx_hash = result["tx_hash"]
            rebalance.mark_success()

            # Calculate APY improvement if both APYs provided
            if rebalance.from_apy and rebalance.to_apy:
                rebalance.apy_improvement = rebalance.to_apy - rebalance.from_apy
                rebalance.save(update_fields=["apy_improvement"])

            return {
                "rebalance_id": rebalance.id,
                "status": "success",
                "tx_hash": result["tx_hash"],
                "from_amount": result["from_amount"],
                "to_amount": result["to_amount"],
                "tool": result["tool"],
            }

        except LiFiExecutionError as e:
            rebalance.mark_failed(f"{e.step}: {str(e)}")
            raise
