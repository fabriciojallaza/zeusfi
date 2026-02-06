"""
Celery tasks for positions app.
"""

import asyncio
import logging

from celery import shared_task

from parameters.common.logger.logger_service import LoggerService

logger = logging.getLogger(__name__)


@shared_task(name="apps.positions.tasks.execute_rebalance_task")
def execute_rebalance_task(rebalance_id: int, data: dict) -> dict:
    """
    Execute a rebalance in the background.

    Args:
        rebalance_id: ID of the RebalanceHistory record
        data: Rebalance parameters

    Returns:
        Dict with execution results
    """
    logger.info(
        f"execute_rebalance_task: Starting rebalance #{rebalance_id}",
        extra={
            "rebalance_id": rebalance_id,
            "from_chain": data.get("from_chain"),
            "to_chain": data.get("to_chain"),
            "from_token": data.get("from_token"),
            "to_token": data.get("to_token"),
        },
    )
    return asyncio.run(_execute_rebalance_async(rebalance_id, data))


async def _execute_rebalance_async(rebalance_id: int, data: dict) -> dict:
    """Async implementation of rebalance execution."""
    from apps.positions.models import RebalanceHistory
    from integrations.lifi import LiFiExecutor, LiFiExecutionError

    try:
        rebalance = await asyncio.to_thread(
            RebalanceHistory.objects.get,
            id=rebalance_id,
        )
    except RebalanceHistory.DoesNotExist:
        logger.error(
            f"execute_rebalance_task: Rebalance not found: {rebalance_id}",
            extra={"rebalance_id": rebalance_id},
        )
        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "404",
            "tasks/execute_rebalance_task",
            "TASK",
            str({"rebalance_id": rebalance_id}),
            str({"error": f"Rebalance not found: {rebalance_id}"}),
        )
        raise Exception(f"execute_rebalance_task: Rebalance not found: {rebalance_id}")

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
        await asyncio.to_thread(rebalance.mark_success)

        # Calculate APY improvement
        if rebalance.from_apy and rebalance.to_apy:
            rebalance.apy_improvement = rebalance.to_apy - rebalance.from_apy
            await asyncio.to_thread(
                rebalance.save,
                update_fields=["apy_improvement"],
            )

        logger.info(
            f"execute_rebalance_task: Rebalance #{rebalance_id} completed successfully",
            extra={
                "rebalance_id": rebalance_id,
                "tx_hash": result["tx_hash"],
                "from_amount": result["from_amount"],
                "to_amount": result["to_amount"],
            },
        )

        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "200",
            "tasks/execute_rebalance_task",
            "TASK",
            str({"rebalance_id": rebalance_id}),
            str(
                {
                    "tx_hash": result["tx_hash"],
                    "from_amount": result["from_amount"],
                    "to_amount": result["to_amount"],
                }
            ),
        )

        return {
            "rebalance_id": rebalance_id,
            "status": "success",
            "tx_hash": result["tx_hash"],
            "from_amount": result["from_amount"],
            "to_amount": result["to_amount"],
        }

    except LiFiExecutionError as e:
        error_msg = f"{e.step}: {str(e)}"
        await asyncio.to_thread(rebalance.mark_failed, error_msg)
        logger.error(
            f"execute_rebalance_task: Rebalance #{rebalance_id} LI.FI execution failed",
            exc_info=True,
            extra={
                "rebalance_id": rebalance_id,
                "step": e.step,
                "error": str(e),
            },
        )
        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "500",
            "tasks/execute_rebalance_task",
            "TASK",
            str({"rebalance_id": rebalance_id, "data": data}),
            str({"step": e.step, "error": str(e)}),
        )
        raise Exception(
            f"execute_rebalance_task: Rebalance #{rebalance_id} failed at {e.step}: {e}"
        )

    except Exception as e:
        error_msg = str(e)
        await asyncio.to_thread(rebalance.mark_failed, error_msg)
        logger.error(
            f"execute_rebalance_task: Rebalance #{rebalance_id} failed unexpectedly",
            exc_info=True,
            extra={
                "rebalance_id": rebalance_id,
                "error": error_msg,
            },
        )
        await asyncio.to_thread(
            LoggerService.create__manual_logg,
            "500",
            "tasks/execute_rebalance_task",
            "TASK",
            str({"rebalance_id": rebalance_id, "data": data}),
            str({"error": error_msg}),
        )
        raise Exception(
            f"execute_rebalance_task: Rebalance #{rebalance_id} failed: {e}"
        )
