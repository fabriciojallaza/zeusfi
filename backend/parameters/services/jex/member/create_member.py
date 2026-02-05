from django.shortcuts import get_object_or_404

from core.drf import NonCriticalValidationError

from members.models import Member
from members.serializers import MemberSerializer  # , MemberAuthSerializer

from user.models import User
from user.serializers import UserSerializer
from user.services.platform_roles import platform_roles


def create_member(custom_request, fake_user=False):
    if user_id := custom_request.get("user"):
        user = get_object_or_404(User, id=user_id)
        user.platform_role_id = platform_roles()["MEMBER"]
        user.save()
        if member := Member.objects.filter(user=user).first():
            return MemberSerializer(member).data, user
    else:
        if custom_request.get("email"):
            custom_request["email"] = custom_request["email"].lower()
            user = User.objects.filter(email=custom_request.get("email")).first()
            if user:
                raise NonCriticalValidationError({"email": ["User already exists"]})
        elif custom_request.get("phone"):
            user = User.objects.filter(phone=custom_request.get("phone")).first()
            if user:
                raise NonCriticalValidationError({"phone": ["User already exists"]})
        else:
            raise NonCriticalValidationError({"email": ["Email or phone is required"]})

        if avatar_raw := custom_request.get("avatar"):
            custom_request["avatar"] = avatar_raw
        custom_request["is_active"] = True
        custom_request["platform_role"] = platform_roles()["MEMBER"]
        # Create User using serializer.Meta.model(**serializer.validated_data)
        user_serializer = UserSerializer(data=custom_request)
        if user_serializer.is_valid(raise_exception=True):
            user = user_serializer.save()
            password = custom_request.get("password")
            if password is not None:
                user.set_password(password)
                user.save()

    # The user variable is always defined at this point (either from the existing user or newly created)
    if user:
        custom_request["user"] = user.pk

    member_serializer = MemberSerializer(data=custom_request)
    member_serializer.is_valid(raise_exception=True)
    member = member_serializer.save()
    # member_serializer = MemberLoginSerializer(member)

    return member_serializer.data, user
