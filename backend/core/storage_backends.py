# import os
# from urllib.parse import urlparse
#
# from storages.backends.s3boto3 import S3Boto3Storage
#
# from backend.core.drf import NonCriticalValidationError
#
#
# class StaticStorage(S3Boto3Storage):
#     location = "static"
#     default_acl = "public-read"
#
#
# class PublicMediaStorage(S3Boto3Storage):
#     location = "public"
#     default_acl = "public-read"
#     file_overwrite = False
#
#     def __init__(self, custom_path=None, *args, **kwargs):
#         super().__init__(*args, **kwargs)
#         if custom_path:
#             self.location = "public/" + custom_path + "/"
#
#
# class PrivateMediaStorage(S3Boto3Storage):
#     location = "private"
#     default_acl = "private"
#     file_overwrite = False
#     custom_domain = False
#
#     def __init__(self, custom_path=None, *args, **kwargs):
#         super().__init__(*args, **kwargs)
#         if custom_path:
#             self.location = "private/" + custom_path + "/"
#
#
# class RawJobPostsStorage(S3Boto3Storage):
#     location = "raw_job_posts"
#     default_acl = "private"
#     file_overwrite = False
#
#
# def s3_object_removal(storage, old_file, new_file):
#     if storage == "public":
#         media_storage = PublicMediaStorage()
#     elif storage == "private":
#         media_storage = PrivateMediaStorage()
#     else:
#         return
#     if old_file and new_file:
#         old_file_path = urlparse(old_file.url).path.lstrip("/")
#         index = old_file_path.find(f"{storage}/")
#         if index != -1:
#             old_file_path = old_file_path[index + len(f"{storage}/") :]
#         if media_storage.exists(old_file_path):
#             media_storage.delete(old_file_path)
#
#
# def validate_image_extension(value):
#     valid_extensions = [".jpg", ".jpeg", ".png", ".webp", ".jfif"]
#     ext = os.path.splitext(value.name)[1]
#     if ext.lower() not in valid_extensions:
#         raise NonCriticalValidationError(
#             {
#                 "error": [
#                     "Unsupported file extension. Only JPG, JPEG, PNG, WEBP, JFIF are allowed."
#                 ]
#             }
#         )
#
#
# def validate_file_name_length(value):
#     if len(value.name) > 50:
#         raise NonCriticalValidationError(
#             {"error": ["File name is too long. Maximum 50 characters allowed."]}
#         )
