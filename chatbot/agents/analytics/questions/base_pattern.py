"""
Base class for Question Patterns

All question patterns should inherit from this class and implement:
- keywords: List of trigger keywords
- followup_buttons(): Generate SQL followup buttons
- chart_configs(): Generate chart configurations (optional)
"""

import logging
from typing import List, Dict, Optional
from abc import ABC, abstractmethod
import pandas as pd

logger = logging.getLogger(__name__)


class QuestionPatternBase(ABC):
    """
    Base class for all question patterns.

    A Question Pattern encapsulates:
    1. Keywords that trigger this pattern
    2. SQL queries for followup analysis
    3. Chart configurations for visualization
    4. Business logic specific to this question type

    Example:
        class ProductionAnnualPattern(QuestionPatternBase):
            keywords = ["producción", "año", "nacional", "bopd"]

            def followup_buttons(self, question: str, data: pd.DataFrame) -> List[Dict]:
                return [
                    {
                        "id": "FU_01",
                        "title": "Variación Interanual",
                        "sql_query": "SELECT ...",
                        ...
                    }
                ]
    """

    # Class-level attributes that subclasses should override
    keywords: List[str] = []
    priority: int = 50  # Higher = checked first (0-100)
    description: str = ""

    def __init__(self):
        """Initialize the question pattern"""
        if not self.keywords:
            raise ValueError(f"{self.__class__.__name__} must define keywords")
        if not self.description:
            logger.warning(f"{self.__class__.__name__} has no description")

    @abstractmethod
    def followup_buttons(
        self, question: str, data: pd.DataFrame
    ) -> List[Dict]:
        """
        Generate followup buttons with SQL queries for this pattern.

        Args:
            question: Original user question
            data: DataFrame with current query results

        Returns:
            List of button configurations with SQL queries
        """
        pass

    def chart_configs(
        self, question: str, data: pd.DataFrame
    ) -> List[Dict]:
        """
        Generate chart configurations for this pattern (optional).

        Args:
            question: Original user question
            data: DataFrame with current query results

        Returns:
            List of chart configurations
        """
        return []

    def matches(self, question: str) -> bool:
        """
        Check if this pattern matches the question.

        Args:
            question: User question to check

        Returns:
            True if pattern matches, False otherwise
        """
        question_lower = question.lower()
        return any(keyword in question_lower for keyword in self.keywords)

    def __repr__(self):
        return f"{self.__class__.__name__}(keywords={self.keywords}, priority={self.priority})"
