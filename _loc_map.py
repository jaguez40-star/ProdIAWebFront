# -*- coding: utf-8 -*-
from pathlib import Path
source = Path('chatbot/agents/analytics/chart_creators/production_reports.py').read_text(encoding='utf-8').splitlines()
patterns = {
    'rename_prog_sep': 'prog_septiembre',
    'numeric_prog_sep': 'for col in ("Prod_Agost", "Prod_Sept", "Prog_Sep", "VAR_PCT")',
    'header_crudo_prog': 'Prog_Sep": "Producci',
    'header_blancos_prog': 'Prog_Sep": "Producci',
    'llm_source_crudo': 'Prod_Sept": "Producci',
    'llm_source_blancos': 'Prod_Sept": "Producci'
}
for label, pattern in patterns.items():
    for idx, line in enumerate(source, start=1):
        if pattern in line:
            print(label, idx)
            break
