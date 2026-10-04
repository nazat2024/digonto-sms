#!/usr/bin/env python3
"""
IVAC Master Pro - Remote Proxy Relay Server
============================================
Lightweight, zero-dependency reverse-tunnel relay server.
Enables remote 4G mobile proxies to bypass CGNAT and accept connections
from Chrome profiles from anywhere across the internet.

Usage:
    python relay_server.py [RELAY_PORT]
Default RELAY_PORT is 9050.
"""

import sys
import socket
import threading
import json
import uuid
import time
import select

DEFAULT_RELAY_PORT = 9050

class RemoteNodeSession:
    def __init__(self, node_id, carrier, control_socket, control_addr, relay_port):
        self.node_id = node_id
        self.carrier = carrier
        self.control_socket = control_socket
        self.control_addr = control_addr
        self.assigned_port = relay_port + (abs(hash(node_id)) % 1000)
        self.pending_channels = {}  # channel_id -> threading.Event()
        self.channel_sockets = {}   # channel_id -> socket
        self.is_active = True
        self.lock = threading.Lock()
        self.proxy_server_sock = None

class RelayServer:
    def __init__(self, host="0.0.0.0", port=DEFAULT_RELAY_PORT):
        self.host = host
        self.port = port
        self.nodes = {}  # node_id -> RemoteNodeSession
        self.lock = threading.Lock()

    def start(self):
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind((self.host, self.port))
        server_sock.listen(128)

        print(f"============================================================")
        print(f"  IVAC Master Pro - Remote Proxy Relay Server")
        print(f"  Listening on {self.host}:{self.port} for 4G Mobile Nodes")
        print(f"============================================================")

        while True:
            try:
                client_sock, client_addr = server_sock.accept()
                threading.Thread(target=self.handle_incoming_connection, args=(client_sock, client_addr), daemon=True).start()
            except Exception as e:
                print(f"[Relay] Accept error: {e}")

    def handle_incoming_connection(self, sock, addr):
        try:
            sock.settimeout(10.0)
            data = sock.recv(4096)
            if not data:
                sock.close()
                return

            line = data.decode("utf-8", errors="ignore").strip().split("\n")[0]
            try:
                msg = json.loads(line)
            except Exception:
                sock.close()
                return

            action = msg.get("action")
            if action == "REGISTER_NODE":
                sock.settimeout(None)
                self.register_node(msg, sock, addr)
            elif action == "ATTACH_CHANNEL":
                sock.settimeout(None)
                self.attach_channel(msg, sock)
            else:
                sock.close()
        except Exception as e:
            try:
                sock.close()
            except Exception:
                pass

    def register_node(self, msg, sock, addr):
        node_id = msg.get("node_id", f"NODE-{int(time.time()) % 10000}")
        carrier = msg.get("carrier", "4G Mobile")

        with self.lock:
            if node_id in self.nodes:
                old_node = self.nodes[node_id]
                old_node.is_active = False
                try:
                    if old_node.proxy_server_sock:
                        old_node.proxy_server_sock.close()
                    old_node.control_socket.close()
                except Exception:
                    pass

            session = RemoteNodeSession(node_id, carrier, sock, addr, self.port)
            self.nodes[node_id] = session

        print(f"\n[+] Mobile Node Connected: {node_id} ({carrier}) from {addr[0]}")
        print(f"    --> Assigned Proxy Port: {session.assigned_port}")
        print(f"    --> Laptop Chrome Proxy: {self.get_local_ip()}:{session.assigned_port}\n")

        # Start Proxy Listener for this Node
        threading.Thread(target=self.run_node_proxy_listener, args=(session,), daemon=True).start()

        # Control Ping/Pong Loop
        try:
            while session.is_active:
                time.sleep(15)
                sock.sendall(b"PING\n")
        except Exception:
            pass
        finally:
            session.is_active = False
            print(f"[-] Mobile Node Disconnected: {node_id}")
            with self.lock:
                if self.nodes.get(node_id) == session:
                    del self.nodes[node_id]
            try:
                if session.proxy_server_sock:
                    session.proxy_server_sock.close()
                sock.close()
            except Exception:
                pass

    def attach_channel(self, msg, stream_sock):
        channel_id = msg.get("channel_id")
        if not channel_id:
            stream_sock.close()
            return

        with self.lock:
            for session in self.nodes.values():
                if channel_id in session.pending_channels:
                    session.channel_sockets[channel_id] = stream_sock
                    session.pending_channels[channel_id].set()
                    return

        stream_sock.close()

    def run_node_proxy_listener(self, session):
        try:
            p_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            p_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            p_sock.bind((self.host, session.assigned_port))
            p_sock.listen(64)
            session.proxy_server_sock = p_sock

            while session.is_active:
                client_sock, client_addr = p_sock.accept()
                threading.Thread(target=self.handle_proxy_client, args=(session, client_sock, client_addr), daemon=True).start()
        except Exception as e:
            if session.is_active:
                print(f"[Proxy Listener Error] Port {session.assigned_port}: {e}")

    def handle_proxy_client(self, session, client_sock, client_addr):
        try:
            client_sock.settimeout(15.0)
            req_data = client_sock.recv(4096)
            if not req_data:
                client_sock.close()
                return

            req_line = req_data.decode("utf-8", errors="ignore").split("\r\n")[0]
            parts = req_line.split(" ")
            if len(parts) < 2:
                client_sock.close()
                return

            method = parts[0].upper()
            target = parts[1]

            if method == "CONNECT":
                # HTTPS Tunnel
                host, port = target.split(":") if ":" in target else (target, 443)
                port = int(port)
                is_connect = True
            else:
                # HTTP Plain
                is_connect = False
                if target.startswith("http://"):
                    target = target[7:]
                host = target.split("/")[0]
                if ":" in host:
                    host, port = host.split(":")
                    port = int(port)
                else:
                    port = 80

            channel_id = str(uuid.uuid4())
            ready_event = threading.Event()

            with session.lock:
                session.pending_channels[channel_id] = ready_event

            # Request phone to open outbound 4G stream
            open_req = json.dumps({
                "action": "OPEN_STREAM",
                "host": host,
                "port": port,
                "channel_id": channel_id
            }) + "\n"

            session.control_socket.sendall(open_req.encode("utf-8"))

            # Wait up to 8s for phone to attach stream channel
            if not ready_event.wait(8.0):
                with session.lock:
                    session.pending_channels.pop(channel_id, None)
                client_sock.sendall(b"HTTP/1.1 504 Gateway Timeout\r\n\r\n")
                client_sock.close()
                return

            with session.lock:
                stream_sock = session.channel_sockets.pop(channel_id, None)
                session.pending_channels.pop(channel_id, None)

            if not stream_sock:
                client_sock.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                client_sock.close()
                return

            if is_connect:
                client_sock.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            else:
                stream_sock.sendall(req_data)

            # Bidirectional pipe
            self.pipe_sockets(client_sock, stream_sock)

        except Exception:
            try:
                client_sock.close()
            except Exception:
                pass

    def pipe_sockets(self, s1, s2):
        s1.setblocking(False)
        s2.setblocking(False)
        while True:
            r, _, _ = select.select([s1, s2], [], [], 30)
            if not r:
                break
            if s1 in r:
                try:
                    data = s1.recv(16384)
                    if not data: break
                    s2.sendall(data)
                except Exception:
                    break
            if s2 in r:
                try:
                    data = s2.recv(16384)
                    if not data: break
                    s1.sendall(data)
                except Exception:
                    break
        try: s1.close()
        except Exception: pass
        try: s2.close()
        except Exception: pass

    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

if __name__ == "__main__":
    relay_port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_RELAY_PORT
    server = RelayServer(port=relay_port)
    server.start()
