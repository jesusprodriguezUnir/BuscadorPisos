require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 1. Configurar sigilo para Puppeteer
puppeteer.use(StealthPlugin());

// 2. Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan variables de entorno SUPABASE_URL o KEY en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Filtros de búsqueda definidos
const FILTROS = {
    minRooms: 2,
    maxPrice: 250000,
};

// 4. Datos mockeados (para usar en desarrollo sin ser bloqueados)
const MOCK_DATA = [
    {
        external_id: 'mock-id-001',
        source: 'idealista',
        url: 'https://www.idealista.com/inmueble/mock-001/',
        title: 'Piso luminoso en el centro (MOCK)',
        current_price: 240000,
        rooms: 2,
        bathrooms: 1,
        size_sqm: 75,
        location: 'Centro, Madrid',
        image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    },
    {
        external_id: 'mock-id-002',
        source: 'fotocasa',
        url: 'https://www.fotocasa.es/es/comprar/vivienda/mock-002',
        title: 'Ático reformado con terraza (MOCK)',
        current_price: 245000, // Precio bajado (antes 260k)
        rooms: 3,
        bathrooms: 2,
        size_sqm: 90,
        location: 'Chamberí, Madrid',
        image_url: 'https://images.unsplash.com/photo-1502672260266-1c1de2d93688?w=800&q=80',
    }
];

// Función para guardar o actualizar en Supabase
async function savePropertyToSupabase(propertyData) {
    try {
        // 1. Comprobar si existe
        const { data: existingProp, error: fetchError } = await supabase
            .from('properties')
            .select('id, current_price')
            .eq('external_id', propertyData.external_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 es "No rows found", si es un error distinto, loguearlo
            console.error(`Error al consultar ${propertyData.external_id}:`, fetchError.message);
            return;
        }

        if (!existingProp) {
            // INSERCIÓN NUEVA
            console.log(`🏠 Nuevo piso encontrado: ${propertyData.title}`);

            const { data: insertedProp, error: insertError } = await supabase
                .from('properties')
                .insert([{
                    ...propertyData,
                    status: 'active'
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // Añadir historial de precio inicial
            const { error: historyError } = await supabase
                .from('price_history')
                .insert([{
                    property_id: insertedProp.id,
                    price: propertyData.current_price
                }]);

            if (historyError) throw historyError;
            console.log(`✅ Propiedad y precio insertados.`);

        } else {
            // YA EXISTE: Actualizar last_seen
            let updatePayload = { last_seen: new Date().toISOString(), status: 'active' };

            // Comprobar si el precio ha bajado (o subido)
            if (propertyData.current_price !== existingProp.current_price) {
                console.log(`📉 ¡Cambio de precio para ${propertyData.external_id}! De ${existingProp.current_price} a ${propertyData.current_price}`);
                updatePayload.current_price = propertyData.current_price;
                // Actualizamos imagen o título en caso de que lo cambiasen (opcional)
                updatePayload.title = propertyData.title;
                updatePayload.image_url = propertyData.image_url;

                // Añadir nuevo historial
                await supabase
                    .from('price_history')
                    .insert([{
                        property_id: existingProp.id,
                        price: propertyData.current_price
                    }]);
            } else {
                console.log(`🔄 Piso ya existente, actualizando 'last_seen': ${propertyData.title}`);
            }

            const { error: updateError } = await supabase
                .from('properties')
                .update(updatePayload)
                .eq('id', existingProp.id);

            if (updateError) throw updateError;
        }
    } catch (err) {
        console.error(`Error procesando ${propertyData.external_id}:`, err);
    }
} // Fin savePropertyToSupabase

async function runScraper(useMockData = false) {
    console.log(`🚀 Iniciando Radar Inmobiliario... (Modo Mock: ${useMockData})`);

    if (useMockData) {
        console.log("⚙️  Usando datos mockeados...");
        for (const item of MOCK_DATA) {
            if (item.rooms >= FILTROS.minRooms) {
                // Omitimos filtro de precio máximo en mock si queremos probar bajadas, o lo aplicamos
                await savePropertyToSupabase(item);
            }
        }
        console.log("✅ Simulación de scraper terminada.");
        return;
    }

    // --- LÓGICA DE SCRAPING CON PUPPETEER REAL ---
    console.log("🕷️ Ejecutando Puppeteer Stealth...");
    const browser = await puppeteer.launch({
        headless: false, // ¡Pon a true para que no abra ventana en el servidor! (false para debug)
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Configuraciones extra de Stealth (opcional)
        await page.setViewport({ width: 1280, height: 800 });

        // Evitar que detecten webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Establecer un User-Agent común de escritorio
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("Navegando al portal (Idealista - Valencia costa/piscina)...");
        const targetUrl = 'https://www.idealista.com/buscar/venta-viviendas/valencia-provincia/con-piscina/';

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await new Promise(r => setTimeout(r, 6000)); // Esperar un poco simulando humano

        console.log("Extrayendo HTML fuente...");
        const htmlContext = await page.content();
        console.log("INICIO HTML:\n" + htmlContext.substring(0, 1500) + "\n...");

        console.log("Tomando captura de pantalla de depuración...");
        await page.screenshot({ path: 'idealista_debug.png', fullPage: true });

        console.log("Extrayendo datos de la página...");

        const properties = await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('article.item');

            items.forEach(item => {
                const elementId = item.getAttribute('data-adid') || item.getAttribute('data-element-id');
                if (!elementId) return;

                const infoContainer = item.querySelector('.item-info-container');
                if (!infoContainer) return;

                const linkEl = infoContainer.querySelector('a.item-link');
                const title = linkEl ? linkEl.innerText.trim() : 'Sin título';
                const url = linkEl ? 'https://www.idealista.com' + linkEl.getAttribute('href') : '';

                const priceEl = infoContainer.querySelector('.item-price');
                let current_price = 0;
                if (priceEl) {
                    const priceText = priceEl.innerText.replace(/[^0-9]/g, '');
                    current_price = parseInt(priceText, 10) || 0;
                }

                const detailEls = infoContainer.querySelectorAll('.item-detail-wrapper .item-detail');
                let rooms = 0;
                let size_sqm = 0;

                detailEls.forEach(detail => {
                    const text = detail.innerText.toLowerCase();
                    if (text.includes('hab')) {
                        rooms = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
                    } else if (text.includes('m²') || text.includes('m2')) {
                        size_sqm = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
                    }
                });

                let image_url = '';
                const imgEl = item.querySelector('picture img');
                if (imgEl) {
                    image_url = imgEl.getAttribute('src') || imgEl.getAttribute('data-ondemand-img') || '';
                }

                const location = title.split(' en ').pop() || 'Valencia';

                results.push({
                    external_id: `idealista-${elementId}`,
                    source: 'idealista',
                    url,
                    title,
                    current_price,
                    rooms,
                    bathrooms: 1, // Por defecto
                    size_sqm,
                    location,
                    image_url
                });
            });
            return results;
        });

        console.log(`🔍 Se han encontrado ${properties.length} inmuebles en la página actual.`);

        for (const prop of properties) {
            // Guardamos en Supabase si es válido el precio, por ejemplo no lo filtramos o le subimos el límite en la constante global
            if (prop.current_price > 0) {
                await savePropertyToSupabase(prop);
            }
        }

    } catch (error) {
        console.error("❌ Error durante el scraping:", error);
    } finally {
        if (browser) {
            console.log("Cerrando navegador en unos instantes...");
            await new Promise(r => setTimeout(r, 4000));
            await browser.close();
        }
    }
}

// Para ejecutar: node index.js [mock]
// Si le pasamos el argumento "mock", usamos datos falsos.
const arg = process.argv[2];
const useMock = arg === 'mock';

runScraper(useMock);
