import random

from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError

from authentication.models import EmailVerification
from authentication.serializers import VerifyEmailSerializer
from core import settings
from parameters.models import Parameters
from parameters.services.jex.emails.email_sender import AuthEmails
from parameters.services.jex.sms_sender import send_sms
from parameters.services.twilio.whatsapp import (
    verify_otp_whatsapp,
    send_otp_whatsapp,
)
from members.models import Member
from user.models import AppleUser

# from parameters.services.jex.sms_sender import send_sms
# from parameters.services.twilio.whatsapp import send_twilio_whatsapp
from user.serializers import UserSerializer
from user.services.platform_roles import platform_roles


class MockVerification:
    """Mock verification object for test cases to mimic EmailVerification model"""

    def __init__(self, email=None, phone=None):
        self.email = email
        self.phone = phone


class OTPHandling:
    def obtain_email(self, request, email=None):
        email_ = None
        if email:
            email_ = email
        elif request.data.get("email"):
            email_ = request.data.get("email")
        elif request.headers.get("Authorization"):
            token = request.headers.get("Authorization").split(" ")[1]
            try:
                user = Token.objects.get(key=token).user
            except Token.DoesNotExist:
                raise ValidationError({"Error": ["Invalid token"]})
            email_ = user.email
        return email_

    def generate_otp_token(self, type, phone=None):
        if type == "whatsapp":
            return None
        if (
            phone == "+15554443322"
            or settings.ENVIRONMENT not in settings.PROD_ENVIRONMENTS
        ):
            return "000000"
        return "".join([str(random.randint(0, 9)) for _ in range(6)])

    def send_otp_token(self, email, verification_code, type, phone):
        """
        Send the OTP token to the user
        """
        if phone and type != "email":
            # Validate phone number exists in entity object
            try:
                if email:
                    entity = Member.objects.filter(user__email=email).first()
                else:
                    entity = Member.objects.filter(user__phone=phone).first()
                if entity:
                    if not entity.user.phone:
                        raise ValidationError(detail="Invalid credentials")
                    elif entity.user.phone != phone:
                        raise ValidationError(detail="Invalid credentials")
            except Member.DoesNotExist:
                pass
        if email:
            EmailVerification.objects.update_or_create(
                email=email,
                defaults={
                    "verification_code": verification_code,
                    "created_at": timezone.now(),
                    "type": type,
                    "is_used": False,
                    "phone": phone,
                },
            )
        elif phone:
            EmailVerification.objects.update_or_create(
                phone=phone,
                defaults={
                    "email": email,
                    "verification_code": verification_code,
                    "created_at": timezone.now(),
                    "type": type,
                    "is_used": False,
                },
            )

        if type == "email":
            AuthEmails.send_otp_email(email, verification_code)
        elif type == "sms":
            message = f"Don Juan: Your authentication code is {verification_code}. Do not share this code with anyone."
            send_sms(message, phone)
        elif type == "whatsapp":
            service_sid = Parameters.objects.get(name="TWILIO_WHATSAPP_OTP").value
            send_otp_whatsapp(phone, service_sid)

    def validate_otp_token(self, request, otp_code, email=None):
        """
        Validate the OTP token
        """
        email = self.obtain_email(request, email=email)
        phone = request.data.get("phone")
        custom_email = "apple@customtest.com"
        custom_phone = "+15554443322"
        if email == custom_email:
            return MockVerification(email=email), email
        if phone == custom_phone:
            return MockVerification(phone=phone), phone
        serializer = VerifyEmailSerializer(
            data={"email": email, "code": otp_code, "phone": phone}
        )
        serializer.is_valid(raise_exception=True)
        # Check whatsapp verification
        try:
            if email:
                verification = EmailVerification.objects.get(
                    email=email, type="whatsapp"
                )
            else:
                verification = EmailVerification.objects.get(
                    phone=phone, type="whatsapp"
                )
            service_sid = Parameters.objects.get(name="TWILIO_WHATSAPP_OTP").value
            if (
                verification.is_valid()
                and verify_otp_whatsapp(
                    to=verification.phone, otp=otp_code, service_sid=service_sid
                )
                == "approved"
            ):
                verification.is_used = True
                verification.save()
                return verification, email
        except EmailVerification.DoesNotExist:
            pass
        try:
            if email:
                verification = EmailVerification.objects.get(
                    email=email, verification_code=otp_code
                )
            else:
                verification = EmailVerification.objects.get(
                    phone=phone, verification_code=otp_code
                )
            if verification.is_valid():
                verification.is_used = True
                verification.save()
                return verification, email
            else:
                return False, None
        except EmailVerification.DoesNotExist:
            return False, None


class UserSignup:
    def signup(self, custom_request, platform_role):
        custom_request["is_external"] = False
        custom_request["is_active"] = True
        custom_request["platform_role"] = platform_roles()[platform_role]

        # lower email
        custom_request["email"] = (
            custom_request["email"].lower() if custom_request.get("email") else None
        )

        user_serializer = UserSerializer(data=custom_request)
        if user_serializer.is_valid(raise_exception=True):
            user = user_serializer.Meta.model(**user_serializer.validated_data)
            if password := custom_request.get("password"):
                user.set_password(password)
            user.save()

            if custom_request.get("apple_id"):
                AppleUser.objects.update_or_create(
                    email=user.email, defaults={"apple_id": custom_request["apple_id"]}
                )
            return user
        raise ValidationError(user_serializer.errors)
