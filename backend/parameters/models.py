from django.db import models


class Parameters(models.Model):
    name = models.CharField(max_length=255, unique=True)
    value = models.CharField(max_length=255, null=True, blank=True)
    value_json = models.JSONField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "parameters"
        verbose_name_plural = "Parameters"

    def __str__(self):
        return self.name


class Log(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50)
    request_method = models.CharField(max_length=50, null=True, blank=True)
    event_path = models.CharField(max_length=150)
    input = models.TextField()
    output = models.TextField(blank=True)
