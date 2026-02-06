#!/usr/bin/env python3
"""
Sign SIWE messages for testing.

Usage:
    python scripts/sign_siwe.py

    Then paste the message from Postman and type END on a new line.
"""

from eth_account import Account
from eth_account.messages import encode_defunct

# Hardhat account #0 (for testing only!)
DEFAULT_PRIVATE_KEY = (
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
)


def sign_message(private_key: str, message: str) -> str:
    """Sign a message with a private key."""
    account = Account.from_key(private_key)
    message_hash = encode_defunct(text=message)
    signed = account.sign_message(message_hash)
    return signed.signature.hex()


def main():
    account = Account.from_key(DEFAULT_PRIVATE_KEY)

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

    print()
    print(f"Message length: {len(message)} chars, {message.count(chr(10)) + 1} lines")

    signature = f"0x{sign_message(DEFAULT_PRIVATE_KEY, message)}"

    print()
    print("=" * 60)
    print("SIGNATURE (copy this to Postman)")
    print("=" * 60)
    print(signature)
    print("=" * 60)


if __name__ == "__main__":
    main()
