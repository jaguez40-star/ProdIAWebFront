# -*- coding: utf-8 -*-
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from resumen.res_mes_var import Resp_Ollama

markdown_text = """## Panorama General y Análisis por Vicepresidencia

Durante el mes, la producción registró **comportamientos diferenciados** entre segmentos.  
Las **Filiales** mantuvieron incrementos sostenidos en los niveles de producción, mientras que las **vicepresidencias GAA y GOR** concentraron los **mayores volúmenes de aceite perdido**.  
La información consolida la **distribución de pérdidas por vicepresidencia y campo**, destacando los activos con mayor impacto en el total nacional.

---

### Análisis por Vicepresidencia

| Vicepresidencia | Campos con mayor aporte a las pérdidas | Aceite perdido (bbl) |
|------------------|---------------------------------------|----------------------|
| **GAA – Operaciones Llanos (Castilla)** | CASTILLA (149.075) – CASTILLA NORTE (51.614) | ≈213.000 |
| **GOR – Operaciones Llanos (Rubiales / Caño Sur)** | RUBIALES (123.851) – CAÑO SUR ESTE (59.470) | ≈183.000 |
| **GCH – Operaciones Meta** | AKACIAS (89.696) – CHICHIMENE (39.671) | ≈90.000 |
| **GCT – Oriente (La Cira / Infantas)** | LA CIRA (62.086) | ≈71.000 |
| **Otras (GRM, GTA, GPA, DFL)** | Campos con pérdidas distribuidas sin un aporte dominante | ≈145.000 |
| **Filiales** | Campos con crecimiento sostenido en producción | — |

---

### ECP SA (Consolidado Nacional)

El consolidado nacional de ECP SA muestra **niveles estables de producción**, con variaciones limitadas respecto al periodo anterior.  
Las pérdidas acumuladas se concentran principalmente en las vicepresidencias **GAA** y **GOR**, que en conjunto representan más de la mitad del total nacional.

---

### Conclusión Integrada

El total de pérdidas de aceite se encuentra **concentrado en cuatro campos principales:**  
**CASTILLA, CASTILLA NORTE, RUBIALES y CAÑO SUR ESTE**, distribuidos entre las vicepresidencias **GAA** y **GOR**.  
Estos activos explican más del **55 % del volumen total de aceite perdido** en el periodo analizado.  
El resto de las pérdidas se encuentra distribuido entre las vicepresidencias **GCH, GCT, GRM, GTA, GPA y DFL**, con contribuciones menores en términos relativos.  
Las **Filiales** presentan resultados de producción superiores al promedio, sin registro de pérdidas significativas."""

Resp_Ollama.loc[:, 'analysis'] = markdown_text
print(markdown_text)
