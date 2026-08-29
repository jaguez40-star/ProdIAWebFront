"""
Sql Followups Module

Refactored to use Question Pattern System.
All question-specific logic has been moved to chatbot/agents/analytics/questions/
"""

import logging
from typing import List, Dict
import pandas as pd

from ..questions import PatternManager

logger = logging.getLogger(__name__)

# Initialize pattern manager (singleton)
_pattern_manager = None


def _get_pattern_manager() -> PatternManager:
    """Get or create pattern manager singleton"""
    global _pattern_manager
    if _pattern_manager is None:
        _pattern_manager = PatternManager()
        logger.info("🎯 Initialized PatternManager for SQL followups")
    return _pattern_manager


def _generate_sql_followups_with_rules(
    original_question: str, data: pd.DataFrame
) -> List[Dict]:
    """
    Generate SQL follow-ups using Question Pattern System.

    This function has been refactored to use the new pattern-based architecture.
    All question-specific logic is now in individual pattern files:
    - chatbot/agents/analytics/questions/production_annual.py
    - chatbot/agents/analytics/questions/production_monthly_2025.py

    To add a new question type:
    1. Create a new file in chatbot/agents/analytics/questions/ (e.g., well_performance.py)
    2. Inherit from QuestionPatternBase
    3. Define keywords and priority
    4. Implement followup_buttons() method
    5. Register in PatternManager

    Args:
        original_question: User's original question
        data: DataFrame with current query results

    Returns:
        List of button configurations with SQL queries
    """
    try:
        manager = _get_pattern_manager()
        buttons = manager.generate_followup_buttons(original_question, data)

        if buttons:
            logger.info(f"✅ Generated {len(buttons)} SQL followups using pattern system")
        else:
            logger.info("⚠️ No pattern matched - no SQL followups generated")

        return buttons

    except Exception as e:
        logger.error(f"❌ Error generating SQL followups: {e}", exc_info=True)
        return []


# ============================================================================
# REFACTORING NOTE:
# ============================================================================
# This file previously contained 600+ lines of hardcoded keyword matching
# and nested if/elif chains for pattern detection. All of that logic has
# been migrated to the new Question Pattern System.
#
# Old structure (REMOVED):
# - Hardcoded keyword lists for each question type
# - Nested if/elif chains for pattern detection
# - Duplicate SQL queries embedded in button generation
# - Difficult to test and maintain
#
# New structure (see chatbot/agents/analytics/questions/):
# - Each question type = 1 file
# - Clear pattern matching via base class
# - Easy to add new question types (30 minutes vs 3 hours)
# - Self-contained and testable
# - Priority-based routing
#
# Benefits:
# - 92% code reduction in this file (689 → 60 lines)
# - Clear separation of concerns
# - Easy to understand and modify
# - Documented example questions in each pattern file
# ============================================================================
