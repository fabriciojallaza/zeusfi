from rest_framework import serializers

from parameters.models import Parameters, Log


class ParametersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parameters
        fields = "__all__"


class LogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Log
        fields = "__all__"
