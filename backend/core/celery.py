import os
from celery import Celery
from django.apps import apps

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
app = Celery("core")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks(lambda: [n.name for n in apps.get_app_configs()])

""" GET ALL CALENDAR EVENTS TASK """
app.conf.beat_schedule = {
    # 📤 Enviar notificaciones individuales ya programadas
    # "send-scheduled-notifications": {
    #     "task": "notifications.tasks.execute_scheduled_notifications",
    #     "schedule": crontab(minute="*/5"),
    # },
}
