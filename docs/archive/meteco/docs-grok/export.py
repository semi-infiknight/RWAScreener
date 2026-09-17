#!/usr/bin/env python3
"""Export Grok CLI session transcripts (chat_history.jsonl) to readable markdown.

Usage: python3 export.py <grok_sessions_project_dir> <output_dir>
Re-runnable: overwrites generated .md files on each run.
"""
import json
import re
import sys
from pathlib import Path

TOOL_RESULT_CAP = 1500  # chars; full text stays in the raw jsonl
USER_MSG_CAP = 4000     # first user msg carries huge system context; cap it

# Secrets the user pasted into chat must not land in the exported markdown.
SECRET_PATTERNS = [
    # Real key literals live only in archive/meteco-private (gitignored).
    (re.compile(r"AAAAAAAAAAAAAAAAAAAAAPEk%2FgEAAAAA[A-Za-z0-9%]+"), "[REDACTED X bearer token]"),
    (re.compile(r"AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]+"), "[REDACTED X bearer token]"),
]


def redact(text: str) -> str:
    for pat, repl in SECRET_PATTERNS:
        text = pat.sub(repl, text)
    return text


def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s or "").strip("-").lower()
    return s[:48] or "untitled"


def text_parts(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text":
                out.append(c.get("text", ""))
            elif isinstance(c, str):
                out.append(c)
        return "\n".join(out)
    return ""


def clean_user_text(text: str) -> str:
    """Strip harness wrappers (<user_info>, <rules>...) so the real prompt shows."""
    # Drop known wrapper blocks
    text = re.sub(r"<user_info>.*?</user_info>", "", text, flags=re.S)
    text = re.sub(r"<rules>.*?</rules>", "", text, flags=re.S)
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "[system-reminder omitted]", text, flags=re.S)
    return text.strip()


def fmt_tool_call(tc: dict) -> str:
    name = tc.get("name", "?")
    args = tc.get("arguments", "")
    try:
        parsed = json.loads(args) if isinstance(args, str) else args
        # keep args compact: short scalar summary
        keys = []
        for k, v in (parsed.items() if isinstance(parsed, dict) else []):
            sv = str(v)
            keys.append(f"{k}={sv[:80]!r}" + ("…" if len(sv) > 80 else ""))
        arg_s = ", ".join(keys)
    except Exception:
        arg_s = str(args)[:200]
    return f"  - `{name}`({arg_s})"


def export_session(session_dir: Path, out_dir: Path) -> tuple[Path, str, int] | None:
    chat = session_dir / "chat_history.jsonl"
    summary_p = session_dir / "summary.json"
    if not chat.exists():
        return None
    title = session_dir.name[:8]
    cwd = ""
    model = ""
    if summary_p.exists():
        try:
            s = json.loads(summary_p.read_text())
            title = s.get("generated_title") or s.get("session_summary") or title
            cwd = (s.get("info") or {}).get("cwd", "")
            model = s.get("current_model_id", "")
        except Exception:
            pass

    lines = [
        f"# {title}",
        "",
        f"- Grok session: `{session_dir.name}`",
        f"- cwd: `{cwd}`" if cwd else "",
        f"- model: `{model}`" if model else "",
        f"- raw: `{chat}`",
        "",
        "---",
        "",
    ]
    n_msgs = 0
    with chat.open() as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                d = json.loads(raw)
            except Exception:
                continue
            t = d.get("type")
            if t == "system":
                lines.append("> [system prompt omitted]\n")
            elif t == "user":
                txt = clean_user_text(text_parts(d.get("content")))
                if not txt:
                    continue
                if len(txt) > USER_MSG_CAP:
                    txt = txt[:USER_MSG_CAP] + "\n\n…[truncated]"
                lines += ["", "## User", "", txt, ""]
                n_msgs += 1
            elif t == "reasoning":
                summ = text_parts(d.get("summary"))
                if summ:
                    lines += ["", f"> *reasoning: {summ[:600]}*", ""]
            elif t == "assistant":
                content = d.get("content") or ""
                if content.strip():
                    lines += ["", "## Assistant", "", content, ""]
                    n_msgs += 1
                for tc in d.get("tool_calls") or []:
                    lines.append(fmt_tool_call(tc))
                if d.get("tool_calls"):
                    lines.append("")
            elif t == "tool_result":
                content = d.get("content") or ""
                if len(content) > TOOL_RESULT_CAP:
                    content = content[:TOOL_RESULT_CAP] + "\n…[truncated — see raw jsonl]"
                lines += ["<details><summary>tool result</summary>", "", "```", content, "```", "", "</details>", ""]
            elif t == "backend_tool_call":
                lines.append(f"> [backend tool call: {d.get('name', '?')}]")
            else:
                lines.append(f"> [unparsed event type={t}]")

    fname = f"{slugify(title)}-{session_dir.name[:8]}.md"
    out_path = out_dir / fname
    out_path.write_text(redact("\n".join(lines)))
    return out_path, title, n_msgs


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    index = ["# Grok session transcripts", "",
             f"Exported from `{src}` by `export.py`.", "",
             "| File | Title | User/assistant msgs |", "|---|---|---|"]
    for session_dir in sorted(src.iterdir()):
        if not session_dir.is_dir():
            continue
        res = export_session(session_dir, out)
        if res:
            path, title, n = res
            index.append(f"| [{path.name}](./{path.name}) | {title} | {n} |")
            print(f"exported {path.name} ({n} msgs)")
    (out / "README.md").write_text("\n".join(index) + "\n")


if __name__ == "__main__":
    main()
