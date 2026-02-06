#!/usr/bin/env python3
"""
Helper script to sign SIWE messages for testing.

Usage:
    python scripts/sign_siwe.py <private_key> <message>

Example:
    python scripts/sign_siwe.py 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 "ZeusFi wants you to sign..."

Or interactively:
    python scripts/sign_siwe.py
"""

import sys
from eth_account import Account
from eth_account.messages import encode_defunct


def sign_message(private_key: str, message: str) -> str:
    """Sign a message with a private key."""
    account = Account.from_key(private_key)
    message_hash = encode_defunct(text=message)
    signed = account.sign_message(message_hash)
    return signed.signature.hex()


def main():
    if len(sys.argv) >= 3:
        private_key = sys.argv[1]
        message = sys.argv[2]
    else:
        print("=== SIWE Message Signer ===\n")

        # Default test private key (Hardhat account #0 - DO NOT USE IN PRODUCTION)
        default_pk = (
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        )
        print("Default test private key (Hardhat #0):")
        print(f"  {default_pk}")
        print("  Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\n")

        private_key = input("Enter private key (or press Enter for default): ").strip()
        if not private_key:
            private_key = default_pk

        print("\nEnter the SIWE message (paste from Postman, then press Enter twice):")
        lines = []
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
        message = "\n".join(lines)

    # Derive address
    account = Account.from_key(private_key)
    print(f"\nWallet Address: {account.address}")

    # Sign
    signature = sign_message(private_key, message)
    print("\nSignature:")
    print(f"0x{signature}")

    print("\n=== Copy this to Postman ===")
    print(f'"wallet_address": "{account.address.lower()}",')
    print(f'"signature": "0x{signature}"')


if __name__ == "__main__":
    main()
