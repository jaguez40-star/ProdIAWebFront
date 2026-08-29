from pathlib import Path
Path('resumen/Resp_AnalisisProduccion.json').write_text(Path('resumen/Resp_AnalisisProduccion.json').read_text(encoding='utf-8').replace('Panorama General Crudo', 'Crudo: Producción vs Meta Panorama General').replace('Panorama General Blancos', 'Productos Blancos: Producción vs Meta Panorama General'), encoding='utf-8')
