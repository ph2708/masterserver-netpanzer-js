# Masterserver Node.js para NetPanzer

Um servidor mestre (`masterserver`) para o jogo **NetPanzer**, implementado em Node.js. Ele gerencia a lista de servidores de jogo ativos, envia desafios de **echo** via UDP e responde a clientes com a lista de servidores.

---

## Funcionalidades

* Gerencia até **64 servidores de jogo** ativos.
* Valida servidores com **heartbeat** e remove inativos após 5 minutos.
* Suporta comandos:

  * **heartbeat**: atualiza ou registra servidor.
  * **list\gamename\netpanzer\final**: retorna lista de servidores ativos.
* Envia **desafios UDP Echo** para verificação de servidores.
* Permite **shutdown remoto** via UDP, somente a partir do endereço `127.0.0.1`.

---

## Pré-requisitos

* Node.js >= 18
* npm (para instalar dependências, se necessário)
* Porta **28900** aberta (TCP e UDP)

---

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/netpanzer-masterserver.git
cd netpanzer-masterserver
```

2. Instale dependências (nenhuma externa neste projeto, mas opcional):

```bash
npm install
```

---

## Uso

### Iniciar o servidor

```bash
node masterserver_full.js
```

O servidor vai escutar **TCP e UDP na porta 28900**:

```text
TCP listening on port 28900
UDP listening on port 28900
```

### Comando de shutdown remoto

Envie via UDP a mensagem:

```
shutdown!
```

apenas a partir do endereço `127.0.0.1`.

---

## Protocolo TCP

### Heartbeat

Os servidores de jogo enviam:

```
heartbeat\port\<PORT>\protocol\<PROTOCOL>
```

* `PORT` → porta do servidor de jogo
* `PROTOCOL` → protocolo utilizado pelo servidor

O masterserver:

1. Atualiza timestamp do servidor.
2. Remove servidores inativos.
3. Envia echo key via UDP para validação.

---

### Listagem de servidores

Clientes podem solicitar a lista de servidores ativos:

```
list\gamename\netpanzer\final
```

O masterserver responde:

```
\ip\<IP>\port\<PORT>\ip\<IP2>\port\<PORT2>\final\
```

---

## Estrutura do Projeto

```
masterserver_full.js   # Servidor mestre principal
```

---

## Configurações

* `PORT` → Porta TCP/UDP do masterserver (default: 28900)
* `MAX_SERVERS` → Número máximo de servidores registrados (default: 64)
* `SERVER_TIMEOUT` → Tempo limite de inatividade de servidores (default: 5 minutos)
* `ADMIN_ADDR` → Endereço autorizado para shutdown (default: 127.0.0.1)

---

## Logs

O servidor registra no console:

* Conexões TCP/UDP
* Heartbeats recebidos
* Remoção de servidores inativos
* Envios de echo
* Erros TCP

---

