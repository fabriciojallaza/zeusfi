#!/usr/bin/env python3
"""
Sign SIWE messages for Postman testing. Prompts for private key each run.

Usage:

    # Interactive — paste message, get signature
    python scripts/sign_siwe.py

    # Full auto — calls nonce endpoint, signs, calls verify, prints JWT
    python scripts/sign_siwe.py --auto
"""

import argparse
import sys

from eth_account import Account
from eth_account.messages import encode_defunct


def _get_private_key() -> str:
    print("Enter private key (0x...): ", end="", flush=True)
    key = input().strip()
    if not key:
        print("ERROR: No private key provided.")
        sys.exit(1)
    return key


def sign_message(private_key: str, message: str) -> str:
    """Sign a message and return 0x-prefixed hex signature."""
    account = Account.from_key(private_key)
    message_hash = encode_defunct(text=message)
    signed = account.sign_message(message_hash)
    return f"0x{signed.signature.hex()}"


def auto_flow(private_key: str, base_url: str) -> None:
    """Full auth flow: nonce → sign → verify → print JWT."""
    import requests

    account = Account.from_key(private_key)
    address = account.address.lower()

    print(f"Wallet: {account.address}")
    print(f"Server: {base_url}\n")

    # Step 1: Get nonce
    print("1. Getting nonce...")
    resp = requests.post(
        f"{base_url}/api/v1/auth/nonce/",
        json={"wallet_address": address},
    )
    resp.raise_for_status()
    data = resp.json()
    nonce = data["nonce"]
    message = data["message"]
    print(f"   Nonce: {nonce}")

    # Step 2: Sign
    print("2. Signing message...")
    signature = sign_message(private_key, message)
    print(f"   Signature: {signature[:20]}...")

    # Step 3: Verify
    print("3. Verifying with backend...")
    resp = requests.post(
        f"{base_url}/api/v1/auth/verify/",
        json={
            "wallet_address": address,
            "message": message,
            "signature": signature,
            "nonce": nonce,
        },
    )
    resp.raise_for_status()
    result = resp.json()
    token = result["token"]

    print()
    print("=" * 60)
    print("JWT TOKEN (paste into Postman {{jwt_token}} variable)")
    print("=" * 60)
    print(token)
    print("=" * 60)
    print()
    print(f"Wallet: {result['wallet']['address']}")
    if result["wallet"].get("ens_name"):
        print(f"ENS: {result['wallet']['ens_name']}")


def interactive_flow(private_key: str) -> None:
    """Paste a SIWE message, get a signature back."""
    account = Account.from_key(private_key)

    print("=" * 60)
    print("SIWE Message Signer")
    print("=" * 60)
    print(f"Wallet: {account.address}")
    print()
    print("Paste the SIWE message from Postman (siwe_message variable),")
    print("then type END on a new line and press Enter:")
    print("-" * 60)

    lines = []
    while True:
        line = input()
        if line.strip().upper() == "END":
            break
        lines.append(line)

    message = "\n".join(lines)

    if not message.strip():
        print("ERROR: No message provided")
        return

    signature = sign_message(private_key, message)

    print()
    print("=" * 60)
    print("SIGNATURE (copy this to Postman)")
    print("=" * 60)
    print(signature)
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Sign SIWE messages for testing")
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Full auto flow: nonce → sign → verify → JWT",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Backend base URL (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    private_key = _get_private_key()

    if args.auto:
        auto_flow(private_key, args.url)
    else:
        interactive_flow(private_key)


if __name__ == "__main__":
    main()
