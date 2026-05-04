"""Unified prompt template rendering for FictionForge agentic workflows.

Supports both Jinja2 {{variable}} syntax (used by skill prompt templates)
and Python str.format() {variable} syntax (used by hardcoded fallback prompts).
"""

import re
from jinja2 import Template, UndefinedError


# Variables that are automatically available to all agentic prompts.
# Keys use snake_case for consistency with the Jinja2 template context.
DEFAULT_VARIABLES = {
    "text": "",
    "fullContext": "",
    "title": "",
    "description": "",
    "document_type": "",
    "field_name": "",
    "document_title": "",
    "module": "",
}


def _has_jinja_variables(template: str) -> bool:
    """Detect whether a template uses Jinja2 {{var}} syntax."""
    return "{{" in template and "}}" in template


def render_prompt(template: str, context: dict | None = None) -> str:
    """
    Render a prompt template with the given context.

    Auto-detects the template syntax:
    - If the template contains {{...}} → uses Jinja2 rendering
    - Otherwise → uses Python str.format() rendering

    All missing variables default to empty strings (no KeyError).
    """
    if not template:
        return ""

    ctx = {**DEFAULT_VARIABLES, **(context or {})}

    if _has_jinja_variables(template):
        try:
            return Template(template, undefined=jinja2_undefined).render(**ctx)
        except UndefinedError:
            # If Jinja2 strict-undefined trips on something, fall through
            # to the format-path as a safety net.
            pass

    # Fallback / format-style path — replace {var} and {var!r} etc.
    # We only substitute known keys so that braces used for JSON inside
    # the template are preserved.
    result = template
    for key, value in ctx.items():
        # Support both {key} and {{key}} (escaped Jinja2) in format-style
        # templates for backward compatibility.
        result = result.replace(f"{{{key}}}", str(value))
        result = result.replace(f"{{{{{key}}}}}", str(value))
    return result


# Monkey-patch Jinja2 undefined to return empty string for missing vars.
class _SilentUndefined:
    """Jinja2 undefined that renders as empty string."""

    def __init__(self, *args, **kwargs):
        pass

    def __str__(self):
        return ""

    def __iter__(self):
        return iter([])

    def __bool__(self):
        return False

    def __len__(self):
        return 0

    def __getitem__(self, key):
        return self

    def __getattr__(self, name):
        return self

    def __call__(self, *args, **kwargs):
        return ""


# Use Jinja2's built-in Undefined if available, otherwise our shim.
try:
    from jinja2 import Undefined

    class SilentUndefined(Undefined):
        def __str__(self):
            return ""

        def __iter__(self):
            return iter([])

        def __bool__(self):
            return False

        def __len__(self):
            return 0

        def __getitem__(self, key):
            return self.__class__(hint=None, obj=None, name=None, exc=UndefinedError)

        def __getattr__(self, name):
            return self.__class__(hint=None, obj=None, name=None, exc=UndefinedError)

        def __call__(self, *args, **kwargs):
            return ""

    jinja2_undefined = SilentUndefined
except Exception:
    jinja2_undefined = _SilentUndefined
