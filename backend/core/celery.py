import os
from celery import Celery
from celery.schedules import crontab
from django.apps import apps

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
app = Celery("core")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks(lambda: [n.name for n in apps.get_app_configs()])
app.autodiscover_tasks(["integrations.ens"])

# Celery Beat Schedule
app.conf.beat_schedule = {
    # Fetch yield data from DeFiLlama every 30 minutes
    "fetch-yields-every-30-min": {
        "task": "apps.yields.tasks.fetch_yields",
        "schedule": crontab(minute="*/30"),
    },
    # Warm ENS cache every 30 minutes (offset by 15 min from yields)
    "warm-ens-cache-every-30-min": {
        "task": "integrations.ens.tasks.warm_ens_cache",
        "schedule": crontab(minute="15,45"),
    },
    # Run agent cycle daily at 6 AM UTC
    "run-agent-cycle-daily": {
        "task": "apps.agent.tasks.run_agent_cycle",
        "schedule": crontab(hour=6, minute=0),
    },
    # Monitor pending agent transactions every 5 minutes
    "monitor-pending-txs": {
        "task": "apps.agent.tasks.monitor_pending_transactions",
        "schedule": crontab(minute="*/5"),
    },
}
