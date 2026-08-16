# SnippKit CLI (`SNiX`) v2 — Complete Master Command & Use-Case Guide

The official terminal companion for **SnippKit**.  
This document is the definitive master manual covering **every single command, subcommand, alias, shortcut, flag, modifier, and usage possibility** implemented in SnippKit CLI v2 (`snix`).

---

## 🏗 System & API Architecture

```
                               ┌─────────────────────────┐
                               │   SnippKit CLI (snix)   │
                               └────────────┬────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
          ┌─────────────────────┐                       ┌─────────────────────┐
          │  Local Credentials  │                       │ Execution Engine    │
          │  AES-256 Vault      │                       │ - Code Scripts      │
          │ (~/.config/snippkit)│                       │ - Shell Playbooks   │
          └─────────────────────┘                       └─────────────────────┘
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │   SnippKit Backend API Routes     │
                          ├───────────────────────────────────┤
                          │ GET  /api/cli/me     (Auth Status)│
                          │ POST /api/s/create   (Push)       │
                          │ GET  /api/cli/list   (List/Search)│
                          │ GET  /api/cli/run    (Fetch/Run)  │
                          │ POST /api/cli/delete (Delete)     │
                          └───────────────────────────────────┘
```

---

## 📑 Master Table of Contents

1. [Canonical CLI Grammar](#1-canonical-cli-grammar)
2. [Global System Flags](#2-global-system-flags)
3. [Authentication Commands (`auth`, `whoami`, `login`, `logout`)](#3-authentication-commands-auth-whoami-login-logout)
4. [Code Snippet Management (`snippets`, `snippet`)](#4-code-snippet-management-snippets-snippet)
5. [Command Playbook Management (`commands`, `command`)](#5-command-playbook-management-commands-command)
6. [Execution Engine (`run`, `script`, `cmd`)](#6-execution-engine-run-script-cmd)
7. [Source Code Upload (`push`)](#7-source-code-upload-push)
8. [Safe Deletion Commands (`delete`, `rm`, `remove`)](#8-safe-deletion-commands-delete-rm-remove)
9. [Search & Discovery (`search`)](#9-search--discovery-search)
10. [System Diagnostics (`doctor`)](#10-system-diagnostics-doctor)
11. [Configuration Inspector (`config`)](#11-configuration-inspector-config)
12. [Legacy Backward Compatibility Commands (`list`, `get`, `pull`)](#12-legacy-backward-compatibility-commands-list-get-pull)
13. [Complete Syntax & Option Matrix](#13-complete-syntax--option-matrix)
14. [Master Quick Reference Cheat Sheet](#14-master-quick-reference-cheat-sheet)

---

## 1. Canonical CLI Grammar

All canonical operations follow a structured grammar pattern:

$$\text{snix } \langle\text{RESOURCE}\rangle \quad \langle\text{ACTION}\rangle \quad [\text{TARGET(S)}] \quad [\text{OPTIONS}]$$

- **Resource**: `snippets`, `commands`, `run`, `auth`, `push`
- **Action**: `list`, `show`, `pull`, `delete`, `script`, `scripts`, `command`, `commands`

---

## 2. Global System Flags

### `snix -V` / `snix --version`
- **Purpose**: Displays current CLI package version.
- **Example**:
  ```bash
  snix --version
  ```

### `snix -h` / `snix --help`
- **Purpose**: Displays the global help screen with canonical commands, options, and examples.
- **Example**:
  ```bash
  snix --help
  ```

### `snix <command> --help`
- **Purpose**: Displays command-specific help, arguments, options, and realistic examples.
- **Examples**:
  ```bash
  snix push --help
  snix snippets --help
  snix run --help
  snix delete --help
  ```

---

## 3. Authentication Commands (`auth`, `whoami`, `login`, `logout`)

Manage authentication credentials stored in the local **AES-256-GCM encrypted vault**.

### `snix auth login`
- **Purpose**: Interactively authenticates the CLI using a SnippKit API Key (`sk_live_...`).
- **Interactive Prompt**: Prompts for API Key input securely (masked).
- **Encryption**: Keys are encrypted via PBKDF2 256-bit key derived from OS username + machine hostname.
- **Example**:
  ```bash
  snix auth login
  ```

### `snix auth status`
- **Purpose**: Displays current authenticated session details (user handle, email address, API base URL, and masked key prefix).
- **Example**:
  ```bash
  snix auth status
  ```

### `snix whoami` (Shortcut Alias)
- **Purpose**: Top-level shortcut alias for `snix auth status`.
- **Example**:
  ```bash
  snix whoami
  ```

### `snix auth logout`
- **Purpose**: Clears stored encrypted credentials from local config.
- **Example**:
  ```bash
  snix auth logout
  ```

---

## 4. Code Snippet Management (`snippets`, `snippet`)

Manage code snippet resources (`snippet` = single item, `snippets` = collection).

### `snix snippets list`
- **Purpose**: Displays a colorized table of saved code snippets in your library with **interactive pagination** (`15 items/page`), **Visibility**, **Size (B/KB/MB)**, and **Created Date**.
- **Aliases**: `snix snippet list`.
- **Pagination**: Prompts `-- Showing X of Y -- [Press Enter for more, q to quit]` when library exceeds 15 items in interactive TTY mode.
- **Example**:
  ```bash
  snix snippets list
  ```

### `snix snippets show <id>`
- **Purpose**: Displays source code of a target snippet in the terminal with syntax highlighting (`GET /api/cli/run?id=<id>&type=snippets`).
- **Arguments**: `<id>` (UUID or URL Slug).
- **Aliases**: `snix snippet show <id>`.
- **Example**:
  ```bash
  snix snippets show format-json
  ```

### `snix snippets pull <id> [-f, --file <path>]`
- **Purpose**: Downloads snippet source code and writes it to a local file.
- **File Naming**: Defaults to `${sanitized_title}_${slug_or_id}.${ext}` (e.g. `format_json_abc123.py`) when `-f` is omitted.
- **Arguments**: `<id>` (UUID or URL Slug).
- **Options**:
  - `-f, --file <path>`: Custom destination output filepath.
- **Aliases**: `snix snippet pull <id>`.
- **Examples**:
  ```bash
  # Download to default filename (e.g. format_json_format-json.py)
  snix snippets pull format-json

  # Download to custom location
  snix snippets pull format-json -f ./utils/format.py
  ```

### `snix snippets delete <ids...> [-y, --yes]`
- **Purpose**: Permanently deletes one or more snippets from database (`POST /api/cli/delete`).
- **Arguments**: `<ids...>` (One or more UUIDs or URL Slugs).
- **Options**:
  - `-y, --yes`: Bypass confirmation prompt.
- **Aliases**: `snix snippets rm <ids...>`, `snix snippets remove <ids...>`.
- **Targeting**: Strictly targets `snippets` table; never deletes command playbooks.
- **Examples**:
  ```bash
  # Delete single snippet
  snix snippets delete format-json

  # Delete multiple snippets in batch
  snix snippets delete format-json clean-db helper-utils --yes
  ```

---

## 5. Command Playbook Management (`commands`, `command`)

Manage multi-step command playbook resources (`command` = single playbook, `commands` = collection).

### `snix commands list`
- **Purpose**: Displays a colorized table of saved command playbooks in your library with **interactive pagination**, **Step Count**, **Visibility**, **Size**, and **Created Date**.
- **Aliases**: `snix command list`.
- **Example**:
  ```bash
  snix commands list
  ```

### `snix commands show <id>`
- **Purpose**: Renders ordered shell steps of a command playbook in the terminal with step numbering and syntax colors.
- **Arguments**: `<id>` (UUID or URL Slug).
- **Aliases**: `snix command show <id>`.
- **Example**:
  ```bash
  snix commands show setup-dev-env
  ```

### `snix commands pull <id> [-f, --file <path>]`
- **Purpose**: Downloads playbook JSON definition to a local file.
- **File Naming**: Defaults to `${sanitized_title}_${slug_or_id}.json` (e.g. `setup_dev_env_setup-dev.json`) when `-f` is omitted.
- **Arguments**: `<id>` (UUID or URL Slug).
- **Options**:
  - `-f, --file <path>`: Custom output filepath.
- **Aliases**: `snix command pull <id>`.
- **Examples**:
  ```bash
  snix commands pull setup-dev-env
  snix commands pull setup-dev-env -f ./playbooks/dev.json
  ```

### `snix commands delete <ids...> [-y, --yes]`
- **Purpose**: Permanently deletes one or more command playbooks from database (`POST /api/cli/delete`).
- **Arguments**: `<ids...>` (One or more UUIDs or URL Slugs).
- **Options**:
  - `-y, --yes`: Bypass confirmation prompt.
- **Aliases**: `snix commands rm <ids...>`, `snix commands remove <ids...>`.
- **Targeting**: Strictly targets `commands` table; never deletes code snippets.
- **Examples**:
  ```bash
  snix commands delete setup-dev-env
  snix commands delete setup-dev-env deploy-app --yes
  ```

---

## 6. Execution Engine (`run`, `script`, `cmd`)

Fetch and execute code scripts or command playbooks locally.

### Canonical Execution Forms

#### Form 1: `snix run script <id>`
- **Purpose**: Executes a single code script snippet using direct executable invocation (`shell: false`) inside an isolated temporary OS directory (`os.tmpdir()`).
- **Arguments**: `<id>` (UUID or URL Slug).
- **Example**:
  ```bash
  snix run script hello-python
  ```

#### Form 2: `snix run scripts <id1> <id2> ...`
- **Purpose**: Executes multiple code script snippets sequentially.
- **Arguments**: `<id1> <id2> ...` (Space-separated list of IDs/Slugs).
- **Example**:
  ```bash
  snix run scripts hello-python format-json clean-cache
  ```

#### Form 3: `snix run command <id> [-y, --yes]`
- **Purpose**: Executes a single multi-step command playbook using the system shell (`shell: true`).
- **Arguments**: `<id>` (UUID or URL Slug).
- **Options**:
  - `-y, --yes`: Bypass interactive trust confirmation warning prompt.
- **Examples**:
  ```bash
  snix run command setup-dev-env
  snix run command setup-dev-env --yes
  ```

#### Form 4: `snix run commands <id1> <id2> ... [-y, --yes]`
- **Purpose**: Executes multiple command playbooks sequentially using the system shell.
- **Arguments**: `<id1> <id2> ...` (Space-separated list of IDs/Slugs).
- **Example**:
  ```bash
  snix run commands setup-dev-env seed-database --yes
  ```

#### Form 5: `snix run [ids...] [options]` (Smart Auto-Detect)
- **Purpose**: Auto-detects whether each item is a code script or command playbook based on returned server payload structure (`code` field vs `commands` array).
- **Options**:
  - `-s, --script`, `--snippet`: Force execution as code script.
  - `-c, --cmd`, `--command`: Force execution as command playbook.
  - `-y, --yes`: Bypass playbook trust confirmation.
- **Examples**:
  ```bash
  snix run hello-python
  snix run hello-python setup-dev-env
  ```

### Top-Level Execution Shortcuts
- `snix script <ids...>` $\rightarrow$ Alias for `snix run scripts <ids...>`
- `snix cmd <ids...> [-y]` $\rightarrow$ Alias for `snix run commands <ids...>`

---

## 7. Source Code Upload (`push`)

Upload local files or directory trees to your SnippKit library with automatic language detection, rate-limiting protection, folder organization, and inline modifiers.

### Options Reference

| Flag | Long Option | Value Format | Description |
| :--- | :--- | :--- | :--- |
| `-r` | `--recursive` | Boolean | Scan subdirectories recursively when uploading folder paths |
| `-p` | `--public`, `--public-all` | Boolean | Force batch default visibility to PUBLIC |
| N/A | `--private`, `--private-all` | Boolean | Force batch default visibility to PRIVATE (Default) |
| N/A | `--folder` | `<path>` | Target folder name to organize snippets into (e.g. `"Python/Automation"`) |
| N/A | `--title` | `<title>` | Override title for single file upload |
| `-s` | `--slug` | `<slug>` | Override unique URL slug for single file upload |
| N/A | `--language` | `<lang>` | Override language auto-detection (e.g. `Python`, `JavaScript`) |
| `-y` | `--yes` | Boolean | Non-interactive mode (accept all intelligent defaults) |

---

### Inline Modifiers & Precedence Rules

#### Inline Modifiers
Append custom modifiers to any file path using colons (`:`):
- **Visibility Modifiers**: `:public`, `:private`
- **Language Modifiers**: `:language=<lang>`, `:lang=<lang>`
- **Title Modifiers**: `:title=<title>`, `:t=<title>`
- **Slug Modifiers**: `:slug=<slug>`, `:s=<slug>`

#### Precedence Order
1. **Title**: `Per-File Modifier (:title=...)` $\rightarrow$ `Global --title` $\rightarrow$ `Filename without extension`
2. **Language**: `Per-File Modifier (:language=python)` $\rightarrow$ `Global --language` $\rightarrow$ `Extension Detection` $\rightarrow$ `Plain Text Fallback`
3. **Visibility**: `Per-File Modifier (:public/:private)` $\rightarrow$ `Global -p / --public` $\rightarrow$ `Default PRIVATE`

#### Plan Validation for Custom Slugs
If custom slugs are specified and your subscription plan does not allow custom slugs, SNiX warns and automatically offers fallback to publish with an auto-generated unique ID.

---

### Push Usage Examples

```bash
# 1. Single File Upload (Private default)
snix push app.py

# 2. Single File Public Upload
snix push app.py --public

# 3. Bulk Upload Multiple Files
snix push main.py utils.js config.json

# 4. Folder Recursive Upload with Destination Folder
snix push ./scripts --recursive --folder "DevOps/Scripts"

# 5. Inline Per-File Visibility Modifiers
snix push app.py:private index.js:public config.json:private

# 6. Inline Per-File Language, Title & Slug Modifiers
snix push script1.txt:language=python:title="Sync DB":slug=sync-db
snix push file1.txt:public:language=python file2.txt:private:language=json

# 7. Non-Interactive Scripting Mode
snix push ./scripts -r --public --folder "DevOps" --yes
```

---

## 8. Safe Deletion Commands (`delete`, `rm`, `remove`)

Top-level convenience shortcuts for deleting database items with non-guessing ambiguity protection.

### Syntax Form
```bash
snix delete <ids...> [options]
snix rm <ids...> [options]
snix remove <ids...> [options]
```

### Options Reference
- `--snippet`: Delete explicitly as code snippet.
- `--command`: Delete explicitly as command playbook.
- `-y, --yes`: Bypass confirmation prompt (refuses deletion if slug is ambiguous).

---

### Ambiguity Protection Matrix

| Invocation | Matching Resources | CLI Behavior |
| :--- | :--- | :--- |
| `snix delete unique-slug` | 1 Snippet or 1 Playbook | Renders metadata card (Title, Slug, Language/Steps, Visibility) and prompts `Continue? [y/N]`. |
| `snix delete hello` | Both Snippet & Playbook exist | Prompts interactive choice menu (*Snippet*, *Command Playbook*, *Cancel*). |
| `snix delete hello --yes` | Both Snippet & Playbook exist | **ABORTS DELETION**. Returns actionable error requiring explicit `snippets delete` or `commands delete`. |
| `snix snippets delete hello` | Both Snippet & Playbook exist | Strictly targets `snippets` table. Deletes snippet `hello`. |
| `snix commands delete hello` | Both Snippet & Playbook exist | Strictly targets `commands` table. Deletes playbook `hello`. |
| `snix delete id1 id2 id3 -y` | Multiple Unique IDs | Iterates and deletes all target IDs sequentially. |

---

## 9. Search & Discovery (`search`)

### `snix search <query>`
- **Purpose**: Searches saved snippets and command playbooks in your library matching search text (`GET /api/cli/list?search=<query>`).
- **Displays**: Colorized, categorized output for both **📁 Snippets** and **⚡ Command Playbooks** with ID/Slug, Title, Language/Steps, Visibility, Size, and Date.
- **Example**:
  ```bash
  snix search "python automation"
  ```

---

## 10. System Diagnostics (`doctor`)

### `snix doctor`
- **Purpose**: Runs a health check on your local CLI environment (Node.js version, OS platform, API URL connectivity, authenticated key status, and availability of 10 language runners).
- **Example**:
  ```bash
  snix doctor
  ```

---

## 11. Configuration Inspector (`config`)

### `snix config`
- **Purpose**: Displays current CLI configuration settings securely without exposing secrets (API Base URL, Masked Key Prefix).
- **Example**:
  ```bash
  snix config
  ```

---

## 12. Legacy Backward Compatibility Commands (`list`, `get`, `pull`)

| Legacy Command | Options | Modern Canonical Replacement | Purpose |
| :--- | :--- | :--- | :--- |
| `snix list` | `-s, --snippets`<br>`-c, --commands` | `snix snippets list`<br>`snix commands list` | List library items |
| `snix get <id>` | `-s, --snippet`<br>`-c, --command` | `snix snippets show <id>`<br>`snix commands show <id>` | View source / steps |
| `snix pull <id>` | `-f, --file <path>`<br>`-s, --snippet`<br>`-c, --command` | `snix snippets pull <id>`<br>`snix commands pull <id>` | Download to disk |

---

## 13. Complete Syntax & Option Matrix

| Command | Subcommand / Target | Short Flags | Long Flags | Description |
| :--- | :--- | :--- | :--- | :--- |
| `auth` | `login` | N/A | N/A | Authenticate API Key into local vault |
| `auth` | `logout` | N/A | N/A | Remove vault credential |
| `auth` | `status` | N/A | N/A | Display active login session details |
| `whoami` | N/A | N/A | N/A | Alias for `snix auth status` |
| `snippets` | `list` | N/A | N/A | List code snippets (Paged with size, date, visibility) |
| `snippets` | `show <id>` | N/A | N/A | Display snippet code with highlighting |
| `snippets` | `pull <id>` | `-f` | `--file <path>` | Download snippet source file (`title_id.ext`) |
| `snippets` | `delete <ids...>` | `-y` | `--yes` | Delete one or more snippets from database |
| `commands` | `list` | N/A | N/A | List command playbooks (Paged with size, date, visibility) |
| `commands` | `show <id>` | N/A | N/A | Display playbook steps |
| `commands` | `pull <id>` | `-f` | `--file <path>` | Download playbook JSON (`title_id.json`) |
| `commands` | `delete <ids...>` | `-y` | `--yes` | Delete one or more playbooks from database |
| `run` | `script <id>` | N/A | N/A | Execute single code script snippet |
| `run` | `scripts <ids...>` | N/A | N/A | Execute multiple code scripts sequentially |
| `run` | `command <id>` | `-y` | `--yes` | Execute single command playbook |
| `run` | `commands <ids...>`| `-y` | `--yes` | Execute multiple command playbooks |
| `script` | `<ids...>` | N/A | N/A | Shortcut for `snix run scripts <ids...>` |
| `cmd` | `<ids...>` | `-y` | `--yes` | Shortcut for `snix run commands <ids...>` |
| `push` | `<files...>` | `-r`<br>`-p`<br>`-s`<br>`-y` | `--recursive`<br>`--public`<br>`--private`<br>`--folder <path>`<br>`--title <title>`<br>`--slug <slug>`<br>`--language <lang>`<br>`--yes` | Upload files/folders with optional inline modifiers (`:public`, `:private`, `:language=`, `:title=`, `:slug=`) |
| `delete` | `<ids...>` | `-y` | `--snippet`<br>`--command`<br>`--yes` | Safe top-level deletion for one or more items |
| `rm` | `<ids...>` | `-y` | `--snippet`<br>`--command`<br>`--yes` | Alias for `snix delete` |
| `search` | `<query>` | N/A | N/A | Search snippets and playbooks in library |
| `doctor` | N/A | N/A | N/A | Run environment health diagnostic |
| `config` | N/A | N/A | N/A | Display CLI configuration settings |

---

## 14. Master Quick Reference Cheat Sheet

```bash
# ---------------------------------------------------------
# AUTHENTICATION
# ---------------------------------------------------------
snix auth login                           # Sign in with API Key
snix auth status                          # View session status
snix whoami                               # Shortcut for auth status
snix auth logout                          # Sign out

# ---------------------------------------------------------
# CODE SNIPPETS
# ---------------------------------------------------------
snix snippets list                        # List snippets (Paged, colored)
snix snippets show format-json            # Render code with highlighting
snix snippets pull format-json            # Download as format_json_format-json.py
snix snippets delete id1 id2 --yes        # Delete multiple snippets

# ---------------------------------------------------------
# COMMAND PLAYBOOKS
# ---------------------------------------------------------
snix commands list                        # List playbooks (Paged, colored)
snix commands show setup-dev-env          # Render playbook shell steps
snix commands pull setup-dev-env          # Download as setup_dev_env_setup-dev-env.json
snix commands delete id1 id2 --yes        # Delete multiple playbooks

# ---------------------------------------------------------
# EXECUTION ENGINE
# ---------------------------------------------------------
snix run script hello-python              # Run single script
snix run scripts hello-python format-json # Run multiple scripts
snix run command setup-dev-env --yes      # Run single playbook
snix run commands setup-dev-env seed-db   # Run multiple playbooks
snix script hello-python                  # Shortcut for run scripts
snix cmd setup-dev-env -y                 # Shortcut for run commands

# ---------------------------------------------------------
# SOURCE UPLOAD (PUSH)
# ---------------------------------------------------------
snix push app.py                          # Push single file (Private)
snix push app.py --public                 # Push single file (Public)
snix push file1.py file2.js config.json   # Push bulk files
snix push ./scripts -r --folder "DevOps"  # Push folder into DevOps
snix push app.py:private:title="Core App":slug=core-app  # Per-file modifiers

# ---------------------------------------------------------
# DELETION SHORTCUTS
# ---------------------------------------------------------
snix delete format-json                   # Top-level safe delete
snix rm id1 id2 -y                        # Delete multiple items

# ---------------------------------------------------------
# UTILITIES & DIAGNOSTICS
# ---------------------------------------------------------
snix search "python automation"           # Search library (Snippets & Commands)
snix doctor                               # Environment health check
snix config                               # View CLI config
```
