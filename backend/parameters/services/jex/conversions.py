from datetime import timedelta, datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from PIL import Image
from django.core.files.base import ContentFile


def number_to_words(n):
    if n == 0:
        return "zero"

    ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

    teens = [
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen",
    ]

    tens = [
        "",
        "",
        "twenty",
        "thirty",
        "forty",
        "fifty",
        "sixty",
        "seventy",
        "eighty",
        "ninety",
    ]

    if 1 <= n < 10:
        return ones[n]
    elif 10 <= n < 20:
        return teens[n - 10]
    elif 20 <= n < 100:
        return tens[n // 10] + ("" if n % 10 == 0 else "-" + ones[n % 10])
    else:
        return str(n)  # Return the number as string if beyond 99


def resize_image(image, max_size=1080):
    """
    Resizes the image if it exceeds the specified max size (in pixels) while keeping the aspect ratio.
    """
    img = Image.open(image)
    width, height = img.size

    # If image size exceeds 1080p for square or rectangular images, resize it
    if width > max_size or height > max_size:
        # Calculate the new size maintaining aspect ratio
        if width > height:
            new_width = max_size
            new_height = int(max_size * (height / width))
        else:
            new_height = max_size
            new_width = int(max_size * (width / height))

        # Resize the image
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Save resized image back to the FileField
        buffer = BytesIO()
        img_format = image.name.split(".")[
            -1
        ].upper()  # Get the image format (JPG, PNG, etc.)
        if img_format == "JPG":
            img_format = "JPEG"  # Pillow uses "JPEG" instead of "JPG"

        img.save(buffer, format=img_format)
        return ContentFile(buffer.getvalue(), name=image.name)
    else:
        # Reset the file pointer to the beginning
        image.seek(0)

    # If no resizing is needed, return the original image
    return image


def round_to_nearest_30_minutes(dt):
    """Round a datetime object to the nearest 30 minutes, ensuring it's in the future."""
    minute = dt.minute
    if minute < 15:
        rounded_minute = 0
    elif minute < 45:
        rounded_minute = 30
    else:  # Round up to the next hour
        dt += timedelta(hours=1)
        rounded_minute = 0

    rounded_time = dt.replace(minute=rounded_minute, second=0, microsecond=0)

    # Ensure the rounded time is in the future
    if rounded_time <= dt:
        rounded_time += timedelta(minutes=30)

    return rounded_time


def generate_execution_times(tokens_remaining_today, time=None):
    est = ZoneInfo("US/Eastern")

    now_in_est = datetime.now(est)
    if time is None:
        start_time = now_in_est.replace(hour=9, minute=0, second=0, microsecond=0)
    else:
        start_time = time.replace(tzinfo=est)

    end_time = now_in_est.replace(hour=18, minute=0, second=0, microsecond=0)

    # Ensure the time window is valid
    if start_time >= end_time:
        return []

    total_seconds = (end_time - start_time).total_seconds()

    if (
        start_time.hour > 9
    ):  # Apply one per hour rule only if start time is after 9 AM EST
        total_hours = total_seconds // 3600
        num_slots = min(tokens_remaining_today, int(total_hours))
        interval = total_hours / num_slots if num_slots > 0 else 1
        execution_times = [
            round_to_nearest_30_minutes(start_time + timedelta(hours=i * interval))
            for i in range(num_slots)
        ]
    else:
        interval = (
            total_seconds / tokens_remaining_today if tokens_remaining_today > 0 else 0
        )
        execution_times = [
            round_to_nearest_30_minutes(start_time + timedelta(seconds=i * interval))
            for i in range(tokens_remaining_today)
        ]

    return execution_times
