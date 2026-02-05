"""
Custom SSH tunnel implementation using Paramiko 4.0.0
Enhanced version with better error handling, logging and reconnection capability.
This module provides direct SSH tunneling without requiring sshtunnel,
which has compatibility issues with Paramiko 4.0.0 due to the removal of DSSKey class.
"""

import paramiko
import threading
import socket
import select
import time
import logging
from typing import Optional, Tuple, Any

logger = logging.getLogger(__name__)


class ParametrikoSSHTunnel:
    """
    Production-ready SSH tunnel implementation using Paramiko 4.0.0 directly.
    Creates a secure tunnel between a local port and a remote endpoint through an SSH server.
    Includes keepalive, reconnection logic and comprehensive error handling.
    """

    def __init__(
        self,
        ssh_address_or_host: Tuple[str, int],
        ssh_username: str,
        ssh_pkey: str,
        remote_bind_address: Tuple[str, int],
        local_bind_address: Tuple[str, int] = ("127.0.0.1", 0),
        keepalive_interval: int = 30,  # Keep connection alive
        max_retry_attempts: int = 3,
    ):
        """
        Initialize the SSH tunnel with connection parameters.

        Args:
            ssh_address_or_host: Tuple with (host, port) of the SSH server
            ssh_username: Username for SSH authentication
            ssh_pkey: Path to the private key file
            remote_bind_address: Tuple with (host, port) of the remote endpoint to connect to
            local_bind_address: Tuple with (host, port) for local binding (default: localhost, random port)
            keepalive_interval: How often to send keepalive packets (in seconds)
            max_retry_attempts: Number of connection attempts before failing
        """
        self.ssh_host, self.ssh_port = ssh_address_or_host
        self.ssh_username = ssh_username
        self.ssh_pkey_path = ssh_pkey
        self.remote_host, self.remote_port = remote_bind_address
        self.local_host, self.local_port = local_bind_address
        self.keepalive_interval = keepalive_interval
        self.max_retry_attempts = max_retry_attempts

        # Internal state
        self.transport: Optional[paramiko.Transport] = None
        self.local_socket: Optional[socket.socket] = None
        self.tunnel_thread: Optional[threading.Thread] = None
        self.keepalive_thread: Optional[threading.Thread] = None
        self.is_running = False
        self._local_bind_port: Optional[int] = None
        self._local_bind_host: Optional[str] = None
        self._connection_lock = threading.Lock()

    @property
    def local_bind_port(self) -> Optional[int]:
        """Get the local port being used by the tunnel."""
        return self._local_bind_port

    @property
    def local_bind_host(self) -> Optional[str]:
        """Get the local host being used by the tunnel."""
        return self._local_bind_host

    @property
    def is_alive(self) -> bool:
        """Check if the tunnel is active."""
        return bool(
            self.is_running
            and self.transport
            and self.transport.is_active()
            and self.local_socket is not None
        )

    def start(self):
        """
        Start the SSH tunnel with retry logic.
        Attempts to establish a connection multiple times before giving up.
        """
        for attempt in range(self.max_retry_attempts):
            try:
                self._establish_connection()
                logger.info(
                    f"SSH tunnel established: {self._local_bind_host}:{self._local_bind_port} -> "
                    f"{self.ssh_host}:{self.ssh_port} -> {self.remote_host}:{self.remote_port}"
                )
                return
            except Exception as e:
                logger.warning(f"SSH tunnel attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retry_attempts - 1:
                    time.sleep(2**attempt)  # Exponential backoff
                else:
                    raise ValueError(
                        f"Failed to establish SSH tunnel after {self.max_retry_attempts} attempts: {e}"
                    )

    def _establish_connection(self):
        """
        Establish SSH connection and setup tunnel.
        - Creates SSH transport
        - Authenticates with private key
        - Sets up local listening socket
        - Starts monitoring threads
        """
        # Load private key with fallback to different types
        private_key = self._load_private_key()

        # Create and configure transport
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)  # Connection timeout
        sock.connect((self.ssh_host, self.ssh_port))

        self.transport = paramiko.Transport(sock)
        self.transport.set_keepalive(self.keepalive_interval)

        # Start SSH session
        self.transport.start_client()
        self.transport.auth_publickey(self.ssh_username, private_key)

        # Create local listening socket
        self.local_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.local_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.local_socket.bind((self.local_host, self.local_port))
        self.local_socket.listen(5)

        # Get actual bound address
        self._local_bind_host, self._local_bind_port = self.local_socket.getsockname()

        # Start background threads
        self.is_running = True
        self.tunnel_thread = threading.Thread(
            name="ssh_tunnel_handler", target=self._handle_connections, daemon=True
        )
        self.tunnel_thread.start()

        # Start keepalive monitoring
        self.keepalive_thread = threading.Thread(
            name="ssh_tunnel_monitor", target=self._monitor_connection, daemon=True
        )
        self.keepalive_thread.start()

    def _load_private_key(self) -> Any:
        """
        Load private key with support for multiple key formats.
        Tries different key types (RSA, Ed25519, ECDSA) until one works.

        Returns:
            Paramiko key object

        Raises:
            ValueError: If no supported key format was found
        """
        key_types = [
            paramiko.RSAKey,
            paramiko.Ed25519Key,
            paramiko.ECDSAKey,
        ]

        for key_type in key_types:
            try:
                return key_type.from_private_key_file(self.ssh_pkey_path)
            except (paramiko.SSHException, ValueError):
                continue

        raise ValueError(
            f"Could not load private key from {self.ssh_pkey_path}. "
            f"Supported types: RSA, Ed25519, ECDSA"
        )

    def _monitor_connection(self):
        """
        Monitor SSH connection and handle reconnection if needed.
        Periodically checks if the connection is still active and attempts to
        reconnect if it's not.
        """
        while self.is_running:
            try:
                if self.transport and not self.transport.is_active():
                    logger.warning("SSH connection lost, attempting reconnection...")
                    with self._connection_lock:
                        if self.is_running:  # Double-check after acquiring lock
                            self._reconnect()
                time.sleep(self.keepalive_interval)
            except Exception as e:
                logger.error(f"Error in connection monitor: {e}")
                time.sleep(5)

    def _reconnect(self):
        """
        Attempt to reconnect the SSH tunnel.
        Closes existing connections and establishes new ones.
        """
        try:
            # Clean up current connection
            if self.transport:
                self.transport.close()
                self.transport = None

            # Re-establish connection
            self._establish_connection()
            logger.info("SSH tunnel reconnected successfully")
        except Exception as e:
            logger.error(f"Failed to reconnect SSH tunnel: {e}")

    def stop(self):
        """
        Stop the SSH tunnel gracefully.
        Cleans up all resources and waits for threads to terminate.
        """
        logger.info("Stopping SSH tunnel...")
        self.is_running = False

        if self.local_socket:
            try:
                self.local_socket.close()
                self.local_socket = None
            except Exception as e:
                logger.warning(f"Error closing local socket: {e}")

        if self.transport:
            try:
                self.transport.close()
                self.transport = None
            except Exception as e:
                logger.warning(f"Error closing transport: {e}")

        # Wait for threads to finish
        for thread, name in [
            (self.tunnel_thread, "tunnel"),
            (self.keepalive_thread, "keepalive"),
        ]:
            if thread and thread.is_alive():
                thread.join(timeout=5)
                if thread.is_alive():
                    logger.warning(f"{name} thread did not terminate gracefully")

    def _handle_connections(self):
        """
        Handle incoming connections and forward them through the SSH tunnel.
        This method runs in a background thread.
        """
        while self.is_running:
            try:
                if not self.local_socket:
                    break

                ready, _, _ = select.select([self.local_socket], [], [], 1.0)
                if not ready:
                    continue

                local_conn, addr = self.local_socket.accept()

                # Create SSH channel
                with self._connection_lock:
                    if not self.transport or not self.transport.is_active():
                        local_conn.close()
                        continue

                    channel = self.transport.open_channel(
                        "direct-tcpip", (self.remote_host, self.remote_port), addr
                    )

                if channel is None:
                    local_conn.close()
                    continue

                # Start forwarding thread
                forward_thread = threading.Thread(
                    target=self._forward_data, args=(local_conn, channel), daemon=True
                )
                forward_thread.start()

            except Exception as e:
                if self.is_running:
                    logger.error(f"Error handling connections: {e}")
                break

    def _forward_data(self, local_conn: socket.socket, channel: paramiko.Channel):
        """
        Forward data between local connection and SSH channel.
        This method runs in a background thread for each connection.

        Args:
            local_conn: Local socket connection
            channel: Paramiko SSH channel
        """

        def forward(source, destination, direction):
            """Helper function to forward data from source to destination"""
            try:
                while True:
                    data = source.recv(4096)
                    if not data:
                        break
                    destination.send(data)
            except Exception as e:
                if self.is_running:
                    logger.debug(f"Forward {direction} ended: {e}")
            finally:
                try:
                    source.close()
                except Exception:
                    pass
                try:
                    destination.close()
                except Exception:
                    pass

        # Start bidirectional forwarding
        local_to_remote = threading.Thread(
            target=forward, args=(local_conn, channel, "local->remote"), daemon=True
        )
        remote_to_local = threading.Thread(
            target=forward, args=(channel, local_conn, "remote->local"), daemon=True
        )

        local_to_remote.start()
        remote_to_local.start()

        local_to_remote.join()
        remote_to_local.join()

    def __enter__(self):
        """Support for context manager (with statement)"""
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Support for context manager (with statement)"""
        self.stop()
