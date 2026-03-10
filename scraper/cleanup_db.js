require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan variables de entorno SUPABASE_URL o KEY en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDatabase() {
    console.log("🧹 Limpiando base de datos...");

    // IDs de los pisos de La Pobla de Farnals que queremos mantener
    const idsToKeep = ['fotocasa-188281218', 'fotocasa-188241811'];

    try {
        const { data, error } = await supabase
            .from('properties')
            .delete()
            .not('external_id', 'in', `(${idsToKeep.join(',')})`);

        if (error) {
            console.error("❌ Error al borrar registros:", error.message);
        } else {
            console.log("✅ Limpieza completada. Solo quedan los 2 pisos de La Pobla de Farnals.");
        }
    } catch (err) {
        console.error("❌ Error inesperado:", err);
    }
}

cleanDatabase();
