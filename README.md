# SnippKit CLI (`SNiX`) v2

![Version](https://img.shields.io/npm/v/@snippkit/cli)
![License](https://img.shields.io/npm/l/@snippkit/cli)
![Downloads](https://img.shields.io/npm/dt/@snippkit/cli)

The official terminal companion for **SnippKit**.  
Manage code snippets, run command playbooks, upload local source files, and execute remote scripts directly from your shell.

---

## 🔒 Technical Security Architecture

### Credential Storage Mechanism
- **Vault Mechanism**: API keys are stored in an application-level **AES-256-GCM encrypted vault** inside `config.json` with restricted file permissions (`0o600` - User read/write only).
- **Key Derivation**: The 256-bit encryption key is derived via `crypto.pbkdf2Sync` (100,000 iterations, SHA-256) combining the OS username (`os.userInfo().username`), machine hostname (`os.hostname()`), and a static vault salt.
- **Access Scope**: Credentials are bound to the specific OS user and machine hostname. Copying `config.json` to another machine invalidates decryption.
- **Legacy Key Migration**: Plaintext `apiKey` entries from legacy installations are automatically encrypted into `secureVault` on first run and removed from disk.

### Execution Security & Trust Model
- **Code Scripts (`snix run script <id>`)**: Executed using direct executable invocation with `shell: false` and discrete argument arrays, avoiding shell interpolation. Isolated in temporary directories (`os.tmpdir()`) and unlinked upon completion or cancellation (`SIGINT`/`SIGTERM`).
- **Command Playbooks (`snix run command <id>`)**: Command playbooks execute multi-step shell commands with the user's current terminal permissions. Interactive execution displays a mandatory trust confirmation prompt before running (`-y, --yes` to bypass non-interactively).

---

## 🛡 Safe Deletion & Ambiguity Protection

When deleting items by URL slug or ID, SnippKit enforces strict data loss protection:

1. **Explicit Commands**: `snix snippets delete id1 id2...` and `snix commands delete id1 id2...` target **only** their respective resource tables.
2. **Ambiguous Slug Protection**: If top-level `snix delete <slug>` or `snix rm <slug>` matches **both** a code snippet and a command playbook:
   - **Interactive TTY Mode**: Displays metadata cards for both items and prompts the user to select which one to delete.
   - **Non-Interactive `--yes` Mode**: **Refuses to guess** and aborts deletion with an actionable error requiring explicit `snippets delete` or `commands delete`.

---

## 📖 Canonical Command Reference

### 1. Authentication

```bash
snix auth login            # Authenticate API Key securely
snix auth status           # View session details (Shortcut: snix whoami)
snix auth logout           # Remove local vault credential
```

### 2. Snippet Management (`snippets`)

```bash
snix snippets list                 # List snippets with pagination, size, date & visibility
snix snippets show <id>            # Render highlighted source code
snix snippets pull <id>            # Download snippet (saves as title_id.ext)
snix snippets delete <ids...>      # Delete one or more snippets (-y to bypass prompt)
```

### 3. Command Playbook Management (`commands`)

```bash
snix commands list                 # List playbooks with pagination, size, date & visibility
snix commands show <id>            # Render ordered playbook shell steps
snix commands pull <id>            # Download playbook (saves as title_id.json)
snix commands delete <ids...>      # Delete one or more playbooks (-y to bypass prompt)
```

### 4. Execution Engine (`run`)

```bash
# Canonical Execution Grammar
snix run script <id>                        # Single code script snippet
snix run scripts <id1> <id2>                # Multiple code script snippets
snix run command <id>                       # Single command playbook
snix run commands <id1> <id2>               # Multiple command playbooks

# Smart Auto-Detect Execution
snix run <id>                               # Single item (auto-detects type)
snix run <id1> <id2>                        # Multiple items (auto-detects type)

# Fast Shortcuts
snix script <id1> <id2>                     # Shortcut for snix run scripts
snix cmd <id1> <id2>                        # Shortcut for snix run commands
```

### 5. Source Code Upload (`push`)

```bash
# Basic & Bulk Uploads
snix push app.py
snix push main.py utils.js config.json
snix push ./scripts --recursive

# Visibility Control
snix push app.py --public                  # Global batch public
snix push app.py:private index.js:public    # Granular per-file visibility

# Per-File Language, Title & Slug Modifiers
snix push script1.txt:language=python:title="Database Sync":slug=sync-db
snix push file1.txt:public:language=python file2.txt:private:language=json

# Folder Target & Non-Interactive Mode
snix push ./scripts -r --folder "DevOps/Scripts" --yes
```

#### Push Override Precedence:
- **Title**: `Per-File Modifier (:title=...)` $\rightarrow$ `Global --title` $\rightarrow$ `Filename without extension`
- **Language**: `Per-File Modifier (:language=python)` $\rightarrow$ `Global --language` $\rightarrow$ `Extension Detection` $\rightarrow$ `Plain Text Fallback`
- **Visibility**: `Per-File Modifier (:public/:private)` $\rightarrow$ `Global --public/--private` $\rightarrow$ `Default PRIVATE`
- **Custom Slug Validation**: If your account subscription plan does not support custom slugs, SNiX warns and seamlessly offers fallback to an auto-generated ID.

---

## 💡 Quick Reference Cheat Sheet

| Task | Canonical Command Syntax |
| :--- | :--- |
| **Login** | `snix auth login` |
| **Check Session** | `snix whoami` |
| **List Snippets (Paged)** | `snix snippets list` |
| **Show Snippet** | `snix snippets show <id>` |
| **Pull Snippet (`title_id.ext`)**| `snix snippets pull <id>` |
| **Delete Multiple Snippets**| `snix snippets delete id1 id2` |
| **List Playbooks (Paged)** | `snix commands list` |
| **Show Playbook** | `snix commands show <id>` |
| **Pull Playbook** | `snix commands pull <id>` |
| **Delete Multiple Playbooks**| `snix commands delete id1 id2` |
| **Run Single Script** | `snix run script <id>` |
| **Run Multiple Scripts** | `snix run scripts <id1> <id2>` |
| **Run Single Playbook** | `snix run command <id>` |
| **Run Multiple Playbooks** | `snix run commands <id1> <id2>` |
| **Push Single File** | `snix push app.py` |
| **Push Per-File Modifiers** | `snix push file1.py:private:title="Core":slug=core-app` |
| **Search Library** | `snix search "python automation"` |
| **Diagnose System** | `snix doctor` |

---

## 📦 Installation

Requires **Node.js 18+**.

```bash
npm install -g @snippkit/cli
```