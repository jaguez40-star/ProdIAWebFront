"""
Pattern Manager

Manages and routes questions to appropriate question patterns.
"""

import logging
import pandas as pd
from typing import List, Dict, Optional

from .base_pattern import QuestionPatternBase
from .production_annual import ProductionAnnualPattern
from .production_monthly_2025 import ProductionMonthly2025Pattern

logger = logging.getLogger(__name__)


class PatternManager:
    """
    Manages question patterns and routes questions to the appropriate handler.

    Usage:
        manager = PatternManager()
        buttons = manager.generate_followup_buttons("Producción anual?", data)
    """

    def __init__(self):
        """Initialize pattern manager with all available patterns"""
        # Register patterns (sorted by priority, highest first)
        self.patterns: List[QuestionPatternBase] = [
            ProductionMonthly2025Pattern(),  # Priority 95
            ProductionAnnualPattern(),        # Priority 90
        ]

        # Sort by priority (highest first)
        self.patterns.sort(key=lambda p: p.priority, reverse=True)

        logger.info(
            f"📦 PatternManager initialized with {len(self.patterns)} patterns: "
            f"{[p.__class__.__name__ for p in self.patterns]}"
        )

    def generate_followup_buttons(
        self, question: str, data: pd.DataFrame
    ) -> List[Dict]:
        """
        Generate followup buttons using pattern matching.

        Args:
            question: Original user question
            data: DataFrame with current query results

        Returns:
            List of button configurations, or empty list if no pattern matches
        """
        logger.info(f"🔍 Searching patterns for question: '{question}'")

        # Try each pattern in priority order
        for pattern in self.patterns:
            if pattern.matches(question):
                logger.info(f"✅ Pattern match: {pattern.__class__.__name__}")

                # Generate buttons using the matched pattern
                buttons = pattern.followup_buttons(question, data)

                if buttons:
                    logger.info(
                        f"📊 Generated {len(buttons)} buttons from {pattern.__class__.__name__}"
                    )
                    return buttons
                else:
                    logger.warning(
                        f"⚠️ Pattern {pattern.__class__.__name__} matched but generated no buttons"
                    )

        logger.info("❌ No pattern matched this question")
        return []

    def add_pattern(self, pattern: QuestionPatternBase):
        """
        Add a new pattern to the manager.

        Args:
            pattern: Question pattern instance to add
        """
        self.patterns.append(pattern)
        self.patterns.sort(key=lambda p: p.priority, reverse=True)
        logger.info(f"➕ Added pattern: {pattern.__class__.__name__} (priority={pattern.priority})")

    def list_patterns(self) -> List[str]:
        """Get list of registered pattern names"""
        return [p.__class__.__name__ for p in self.patterns]
