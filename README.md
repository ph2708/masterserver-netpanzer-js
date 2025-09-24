# NetPanzer Masterserver (Node.js)

A **master server** for the game **NetPanzer**, implemented in Node.js.
It manages active game servers, sends **UDP echo challenges**, and responds to clients with the server list.

---

## Features

* Manages up to **64 active game servers**.
* Validates servers via **heartbeat** and removes inactive ones after 5 minutes.
* Supports commands:

  * **heartbeat** – updates or registers a server.
  * **list\gamename\netpanzer\final** – returns the list of active servers.
* Sends **UDP Echo challenges** to validate servers.
* Allows **remote shutdown** via UDP, only from `127.0.0.1`.

---

## Prerequisites

* Node.js >= 18
* npm (optional, for installing dependencies)
* Port **28900** open (TCP and UDP)

---

## Installation

1. Clone the repository:

```bash
mkdir masterservernp
git clone https://github.com/your-username/netpanzer-masterserver.git
cd masterservernp
```

2. Install dependencies (none required, but optional):

```bash
npm install
```

---

## Usage

### Start the server

```bash
node masterserver.js
```

The server will listen on **TCP and UDP port 28900**:

```text
TCP listening on port 28900
UDP listening on port 28900
```

### Remote shutdown command

Send via UDP:

```
shutdown!
```

Only accepted from `127.0.0.1`.

---

## TCP Protocol

### Heartbeat

Game servers send:

```
heartbeat\port\<PORT>\protocol\<PROTOCOL>
```

* `PORT` → game server port
* `PROTOCOL` → server protocol version

The masterserver:

1. Updates server timestamp.
2. Removes inactive servers.
3. Sends UDP echo key for validation.

---

### Server list

Clients can request the list of active servers:

```
list\gamename\netpanzer\final
```

The masterserver responds:

```
\ip\<IP>\port\<PORT>\ip\<IP2>\port\<PORT2>\final\
```

---

## Project Structure

```
masterserver_full.js   # Main masterserver file
```

---

## Configuration

* `PORT` → TCP/UDP port of masterserver (default: 28900)
* `MAX_SERVERS` → Maximum registered servers (default: 64)
* `SERVER_TIMEOUT` → Server inactivity timeout in milliseconds (default: 5 minutes)
* `ADMIN_ADDR` → Authorized address for shutdown (default: 127.0.0.1)

---

## Logging

The server logs:

* TCP/UDP connections
* Received heartbeats
* Inactive server removal
* Echo messages sent
* TCP errors

---

## License

MIT License © \[Your Name]

