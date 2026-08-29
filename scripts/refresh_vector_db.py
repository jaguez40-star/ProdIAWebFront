"""
Script para regenerar la base de datos vectorial con ejemplos actualizados
Este script:
1. Limpia la BD vectorial existente (obsoleta)
2. Re-carga todos los ejemplos desde knowledge_base/*.yaml
3. Verifica que los nuevos ejemplos están correctos
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from chatbot.core.vector_manager import get_vector_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def refresh_vector_database():
    """Regenerar base de datos vectorial completamente"""

    print("=" * 70)
    print("REGENERANDO BASE DE DATOS VECTORIAL")
    print("=" * 70)

    try:
        vm = get_vector_manager()

        # 1. Mostrar estado actual
        print("\n[ESTADO ACTUAL]")
        stats_before = vm.get_stats()
        print(f"   - sql_examples: {stats_before['collections']['sql_examples']['count']} documentos")
        print(f"   - database_schemas: {stats_before['collections']['database_schemas']['count']} documentos")

        # 2. Limpiar colecciones obsoletas
        print("\n[LIMPIANDO COLECCIONES OBSOLETAS]")

        # Limpiar sql_examples
        try:
            sql_collection = vm.collections.get('sql_examples')
            if sql_collection:
                # Obtener todos los IDs
                all_items = sql_collection.get()
                if all_items and all_items['ids']:
                    print(f"   Eliminando {len(all_items['ids'])} ejemplos SQL antiguos...")
                    sql_collection.delete(ids=all_items['ids'])
                    print("   [OK] sql_examples limpiado")
        except Exception as e:
            print(f"   ⚠️ Error limpiando sql_examples: {e}")

        # Limpiar database_schemas
        try:
            schema_collection = vm.collections.get('database_schemas')
            if schema_collection:
                all_items = schema_collection.get()
                if all_items and all_items['ids']:
                    print(f"   Eliminando {len(all_items['ids'])} schemas antiguos...")
                    schema_collection.delete(ids=all_items['ids'])
                    print("   [OK] database_schemas limpiado")
        except Exception as e:
            print(f"   ⚠️ Error limpiando database_schemas: {e}")

        # 3. Recargar desde knowledge_base/
        print("\n[RECARGANDO DESDE knowledge_base/]")
        success = vm.embed_database_schemas()

        if success:
            print("   [OK] Schemas y ejemplos recargados exitosamente")
        else:
            print("   [ERROR] Error recargando schemas")
            return False

        # 4. Verificar estado final
        print("\n[ESTADO FINAL]")
        stats_after = vm.get_stats()
        print(f"   - sql_examples: {stats_after['collections']['sql_examples']['count']} documentos")
        print(f"   - database_schemas: {stats_after['collections']['database_schemas']['count']} documentos")

        # 5. Validar con búsqueda de prueba
        print("\n[VALIDACION CON BUSQUEDA DE PRUEBA]")
        test_query = "producción nacional por año"
        results = vm.search_similar_content(
            query=test_query,
            collection_name="sql_examples",
            top_k=3,
            filters={"database": "ecp_prod"}
        )

        print(f"   Query: '{test_query}'")
        print(f"   Resultados: {len(results)}")

        if results:
            print("\n   [PRIMER EJEMPLO RECUPERADO]")
            first_result = results[0]
            print(f"   Score: {first_result.similarity_score:.3f}")
            print(f"   Content:\n{first_result.content[:300]}...")

            # Verificar que NO contiene tablas obsoletas
            if "TT_GERENCIA_AÑO_PROD" in first_result.content:
                print("\n   [WARNING] Ejemplo aun contiene TT_GERENCIA_ANO_PROD")
                print("   Esto puede indicar que knowledge_base/*.yaml no esta actualizado")
            else:
                print("\n   [OK] Ejemplo NO contiene tablas obsoletas")

        # 6. Test adicional con query de 2025
        print("\n[TEST ADICIONAL - Query 2025]")
        test_query_2025 = "producción de hidrocarburos mensual 2025"
        results_2025 = vm.search_similar_content(
            query=test_query_2025,
            collection_name="sql_examples",
            top_k=3,
            filters={"database": "ecp_prod"}
        )

        print(f"   Query: '{test_query_2025}'")
        print(f"   Resultados: {len(results_2025)}")

        if results_2025:
            print("\n   [PRIMER EJEMPLO RECUPERADO]")
            first_result_2025 = results_2025[0]
            print(f"   Score: {first_result_2025.similarity_score:.3f}")
            print(f"   Content:\n{first_result_2025.content[:300]}...")

            # Verificar que menciona PROD_2025
            if "PROD_2025" in first_result_2025.content:
                print("\n   [OK] Ejemplo correcto - usa tabla PROD_2025")
            else:
                print("\n   [WARNING] Ejemplo no menciona PROD_2025")

        print("\n" + "=" * 70)
        print("REGENERACION COMPLETADA EXITOSAMENTE")
        print("=" * 70)
        return True

    except Exception as e:
        print(f"\n[ERROR CRITICO]: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = refresh_vector_database()
    exit(0 if success else 1)
