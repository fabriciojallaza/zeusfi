import json
from copy import deepcopy

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.serializers.json import DjangoJSONEncoder

from parameters.serializers.log_serializer import LogSerializer


class LoggerService:
    @staticmethod
    def delete_in_memory_files(query_dict_log):
        keys_to_delete = []
        try:
            # if input is a list pass
            if isinstance(query_dict_log, list):
                pass
            else:
                for key, value in query_dict_log.items():
                    if isinstance(value, InMemoryUploadedFile):
                        # Mark keys for deletion
                        keys_to_delete.append(key)

                # Delete the marked keys outside the loop
                for key in keys_to_delete:
                    in_memory_file = query_dict_log[key]
                    in_memory_file.close()  # Close the file to release resources
                    del query_dict_log[key]  # Remove the key from the QueryDict
        except Exception as e:
            print(e)

    @staticmethod
    def create_logg(status, request, output, background_task=False):
        if isinstance(request, dict):
            input_data = json.dumps(request, default=str, cls=DjangoJSONEncoder)

            log_serializer = LogSerializer(
                data={
                    "status": status,
                    "event_path": request["path"],
                    "request_method": request["method"],
                    "input": str(input_data),
                    "output": str(output),
                }
            )
            log_serializer.is_valid(raise_exception=True)
            log_serializer.save()

            return

        # drop any kind of files from input data to avoid any kind of errors
        if background_task:
            input_data = json.dumps(request.data, default=str, cls=DjangoJSONEncoder)
        else:
            LoggerService.delete_in_memory_files(request.data)
            input_data = deepcopy(request.data)

        log_serializer = LogSerializer(
            data={
                "status": status,
                "event_path": request.path,
                "request_method": request.method,
                "input": str(input_data),
                "output": str(output),
            }
        )
        log_serializer.is_valid(raise_exception=True)
        log_serializer.save()

    @staticmethod
    def create__manual_logg(status, event_path, request_method, input_data, output):
        log_serializer = LogSerializer(
            data={
                "status": status,
                "event_path": event_path,
                "request_method": request_method,
                "input": str(input_data),
                "output": str(output),
            }
        )
        log_serializer.is_valid(raise_exception=True)
        log_serializer.save()
