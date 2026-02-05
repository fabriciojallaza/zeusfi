"""
Pydantic models for LI.FI API types.
"""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class QuoteRequest(BaseModel):
    """Request parameters for LI.FI quote endpoint."""

    fromChain: int = Field(..., description="Source chain ID")
    fromToken: str = Field(..., description="Source token address")
    fromAmount: str = Field(..., description="Amount in wei/smallest unit")
    toChain: int = Field(..., description="Destination chain ID")
    toToken: str = Field(..., description="Destination token address")
    fromAddress: str = Field(..., description="Sender address (vault)")
    slippage: float = Field(default=0.03, description="Slippage tolerance (0.03 = 3%)")
    allowBridges: list[str] | None = Field(
        default=None,
        description="Allowed bridge protocols",
    )
    denyBridges: list[str] | None = Field(
        default=None,
        description="Denied bridge protocols",
    )
    preferBridges: list[str] | None = Field(
        default=None,
        description="Preferred bridge protocols",
    )


class TokenInfo(BaseModel):
    """Token information from LI.FI."""

    address: str
    symbol: str
    decimals: int
    chainId: int
    name: str
    priceUSD: str | None = None


class FeeCost(BaseModel):
    """Fee cost information."""

    name: str
    description: str | None = None
    percentage: str | None = None
    token: TokenInfo | None = None
    amount: str | None = None
    amountUSD: str | None = None
    included: bool = True


class GasCost(BaseModel):
    """Gas cost information."""

    type: str
    price: str | None = None
    estimate: str | None = None
    limit: str | None = None
    amount: str
    amountUSD: str | None = None
    token: TokenInfo | None = None


class Estimate(BaseModel):
    """Quote estimate information."""

    fromAmount: str
    toAmount: str
    toAmountMin: str
    approvalAddress: str | None = None
    executionDuration: int | None = None
    feeCosts: list[FeeCost] = []
    gasCosts: list[GasCost] = []

    @property
    def from_amount_decimal(self) -> Decimal:
        """Get from amount as Decimal."""
        return Decimal(self.fromAmount)

    @property
    def to_amount_decimal(self) -> Decimal:
        """Get to amount as Decimal."""
        return Decimal(self.toAmount)

    @property
    def total_gas_usd(self) -> Decimal:
        """Calculate total gas cost in USD."""
        total = Decimal("0")
        for gas in self.gasCosts:
            if gas.amountUSD:
                total += Decimal(gas.amountUSD)
        return total


class TransactionRequest(BaseModel):
    """Transaction data to execute."""

    to: str = Field(..., description="Contract address (LI.FI Diamond)")
    data: str = Field(..., description="Calldata for the transaction")
    value: str = Field(..., description="Native token value to send")
    gasLimit: str | None = Field(None, description="Recommended gas limit")
    gasPrice: str | None = Field(None, description="Recommended gas price")
    chainId: int | None = Field(None, description="Chain ID for the transaction")


class Action(BaseModel):
    """Action in the route."""

    fromToken: TokenInfo
    toToken: TokenInfo
    fromChainId: int
    toChainId: int
    slippage: float | None = None
    fromAmount: str
    fromAddress: str | None = None
    toAddress: str | None = None


class QuoteResponse(BaseModel):
    """Response from LI.FI quote endpoint."""

    id: str
    type: str
    tool: str
    action: Action
    estimate: Estimate
    transactionRequest: TransactionRequest | None = None
    includedSteps: list[Any] = []

    @property
    def is_cross_chain(self) -> bool:
        """Check if this is a cross-chain quote."""
        return self.action.fromChainId != self.action.toChainId

    @property
    def bridge_used(self) -> str | None:
        """Get the bridge tool used."""
        if self.is_cross_chain:
            return self.tool
        return None


class StatusRequest(BaseModel):
    """Request parameters for LI.FI status endpoint."""

    txHash: str = Field(..., description="Transaction hash to check")
    bridge: str | None = Field(None, description="Bridge used")
    fromChain: int | None = Field(None, description="Source chain ID")
    toChain: int | None = Field(None, description="Destination chain ID")


class StatusResponse(BaseModel):
    """Response from LI.FI status endpoint."""

    transactionId: str | None = None
    sending: dict | None = None
    receiving: dict | None = None
    status: str  # PENDING, DONE, FAILED, NOT_FOUND
    substatus: str | None = None
    substatusMessage: str | None = None
    tool: str | None = None

    @property
    def is_complete(self) -> bool:
        """Check if transaction is complete."""
        return self.status == "DONE"

    @property
    def is_failed(self) -> bool:
        """Check if transaction failed."""
        return self.status == "FAILED"

    @property
    def is_pending(self) -> bool:
        """Check if transaction is still pending."""
        return self.status == "PENDING"
