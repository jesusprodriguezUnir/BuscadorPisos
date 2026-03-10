require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan variables de entorno SUPABASE_URL o KEY en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Lista de Inmuebles ficticios pero realistas de la costa de Valencia con Piscina
const MOCK_VALENCIA_DATA = [
    {
        external_id: 'valencia-costa-001',
        source: 'idealista (simulado)',
        url: '#',
        title: 'Chalet independiente en Cullera con piscina infinita',
        current_price: 350000, // Precio actual
        rooms: 4,
        bathrooms: 3,
        size_sqm: 180,
        location: 'Cullera, Valencia',
        image_url: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&q=80',
        original_price: 365000 // Para simular bajada
    },
    {
        external_id: 'valencia-costa-002',
        source: 'fotocasa (simulado)',
        url: '#',
        title: 'Apartamento en 1ª línea de playa con zonas comunes y piscina',
        current_price: 210000,
        rooms: 2,
        bathrooms: 1,
        size_sqm: 75,
        location: 'Gandía Playa, Valencia',
        image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
        original_price: null // Sin bajada
    },
    {
        external_id: 'valencia-costa-003',
        source: 'idealista (simulado)',
        url: '#',
        title: 'Adosado de diseño en Port Saplaya (La pequeña Venecia)',
        current_price: 285000,
        rooms: 3,
        bathrooms: 2,
        size_sqm: 120,
        location: 'Port Saplaya, Alboraya',
        image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
        original_price: 300000 // Para simular bajada
    },
    {
        external_id: 'valencia-costa-004',
        source: 'habitaclia (simulado)',
        url: '#',
        title: 'Dúplex con terraza solárium y piscina comunitaria',
        current_price: 195000,
        rooms: 2,
        bathrooms: 2,
        size_sqm: 90,
        location: 'El Saler, Valencia',
        image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
        original_price: null
    },
    {
        external_id: 'valencia-costa-005',
        source: 'idealista (simulado)',
        url: '#',
        title: 'Villa mediterránea a 500m del mar',
        current_price: 450000,
        rooms: 5,
        bathrooms: 4,
        size_sqm: 250,
        location: 'Oliva Nova, Valencia',
        image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
        original_price: 490000 // Gran bajada
    },
    {
        external_id: 'fotocasa-188241811',
        source: 'fotocasa',
        url: 'https://www.fotocasa.es/es/comprar/vivienda/la-pobla-de-farnals/zona-comunitaria-ascensor-piscina-no-amueblado/188241811/d?stc=dis-sharead-sharead&utm_medium=social-share&utm_source=sharead&utm_campaign=sharead',
        title: 'Piso con zona comunitaria, ascensor y piscina en La Pobla de Farnals',
        current_price: 185000,
        rooms: 2,
        bathrooms: 1,
        size_sqm: 78,
        location: 'La Pobla de Farnals, Valencia',
        image_url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&q=80',
        original_price: 190000 // Simulando ligera bajada
    },
    {
        external_id: 'farnals-simulado-001',
        source: 'habitaclia',
        url: '#',
        title: 'Apartamento luminoso en complejo con piscina y pistas de pádel',
        current_price: 172000,
        rooms: 2,
        bathrooms: 2,
        size_sqm: 85,
        location: 'La Pobla de Farnals, Valencia',
        image_url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
        original_price: null
    },
    {
        external_id: 'farnals-simulado-002',
        source: 'idealista (simulado)',
        url: '#',
        title: 'Ático dúplex espectacular en Complejo Residencial Ramses',
        current_price: 245000,
        rooms: 3,
        bathrooms: 2,
        size_sqm: 110,
        location: 'La Pobla de Farnals, Valencia',
        image_url: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&q=80',
        original_price: 260000
    }
];

async function seedDatabase() {
    console.log('🌱 Iniciando inyección de datos de la Costa Blanca/Valencia...');

    for (const item of MOCK_VALENCIA_DATA) {
        const propertyData = {
            external_id: item.external_id,
            source: item.source,
            url: item.url,
            title: item.title,
            current_price: item.current_price,
            rooms: item.rooms,
            bathrooms: item.bathrooms,
            size_sqm: item.size_sqm,
            location: item.location,
            image_url: item.image_url,
            status: 'active'
        };

        try {
            // 1. Verificar si existe
            const { data: existingProp } = await supabase
                .from('properties')
                .select('id')
                .eq('external_id', item.external_id)
                .single();

            let propertyId;

            if (!existingProp) {
                // 2. Insertar propiedad nueva
                const { data: insertedProp, error: insertError } = await supabase
                    .from('properties')
                    .insert([propertyData])
                    .select()
                    .single();

                if (insertError) throw insertError;
                propertyId = insertedProp.id;
                console.log(`✅ Creado: ${item.title}`);
            } else {
                propertyId = existingProp.id;
                console.log(`🔄 Ya existía: ${item.title} (Saltando creación)`);
            }

            // 3. Simular Historial de Precios para mostrar bajadas en UI
            // Si tiene 'original_price', insertamos un registro de hace 1 semana y el actual hoy.
            if (item.original_price) {
                // Verificar si ya tiene historial para no duplicarlo infinitamente en ejecuciones repetidas
                const { data: historyData } = await supabase
                    .from('price_history')
                    .select('id')
                    .eq('property_id', propertyId);

                if (!historyData || historyData.length === 0) {
                    let oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                    // Insertar precio antiguo en fecha pasada
                    await supabase.from('price_history').insert([{
                        property_id: propertyId,
                        price: item.original_price,
                        date_recorded: oneWeekAgo.toISOString()
                    }]);

                    // Insertar precio actual hoy
                    await supabase.from('price_history').insert([{
                        property_id: propertyId,
                        price: item.current_price,
                        date_recorded: new Date().toISOString()
                    }]);
                    console.log(`📉 Historial inyectado: Bajada de ${item.original_price} a ${item.current_price}`);
                }
            } else {
                // Si no tiene bajada, insertamos el actual como historial normal
                const { data: historyData } = await supabase
                    .from('price_history')
                    .select('id')
                    .eq('property_id', propertyId);

                if (!historyData || historyData.length === 0) {
                    await supabase.from('price_history').insert([{
                        property_id: propertyId,
                        price: item.current_price
                    }]);
                }
            }

        } catch (err) {
            console.error(`❌ Error procesando ${item.external_id}: ${err.message}`);
        }
    }

    console.log('✨ Seed finalizado. Abre tu frontend de Astro para ver los resultados.');
}

seedDatabase();
