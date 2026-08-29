"""
Question Pattern System

This module implements a pattern-based system for handling specific question types
with predefined SQL queries, followup buttons, and chart configurations.

Each question pattern is self-contained in a single file, making it easy to:
- Add new question types
- Maintain existing patterns
- Test specific question flows
- Document business logic

Pattern files should inherit from QuestionPatternBase and implement:
- keywords: List of keywords that trigger this pattern
- followup_buttons: Method that returns SQL followup buttons
- chart_configs: Method that returns chart configurations (optional)
"""

from .base_pattern import QuestionPatternBase
from .production_annual import ProductionAnnualPattern
from .production_monthly_2025 import ProductionMonthly2025Pattern
from .pattern_manager import PatternManager

__all__ = [
    "QuestionPatternBase",
    "ProductionAnnualPattern",
    "ProductionMonthly2025Pattern",
    "PatternManager",
]
