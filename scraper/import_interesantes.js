require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeProperty(page, url) {
    console.log(`🔍 Navegando a: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    } catch (e) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    await new Promise(r => setTimeout(r, 6000));

    const source = url.includes('fotocasa.es') ? 'fotocasa' : url.includes('idealista.com') ? 'idealista' : 'unknown';

    let external_id = '';
    if (source === 'fotocasa') {
        const match = url.match(/\/(\d+)(\/|$)/);
        external_id = match ? `fotocasa-${match[1]}` : `fotocasa-${Date.now()}`;
    } else if (source === 'idealista') {
        const match = url.match(/inmueble\/(\d+)\//);
        external_id = match ? `idealista-${match[1]}` : `idealista-${Date.now()}`;
    } else {
        external_id = `manual-${Date.now()}`;
    }

    const details = await page.evaluate((source) => {
        let title = '', price = 0, rooms = 0, size = 0, location = '', image_url = '';

        if (source === 'fotocasa') {
            // Título: H1 es lo más seguro
            title = document.querySelector('h1')?.innerText?.trim() || '';
            const priceEl = document.querySelector('.re-DetailHeader-price') || document.querySelector('[class*="price"]');
            price = priceEl ? parseInt(priceEl.innerText.replace(/[^0-9]/g, ''), 10) : 0;

            // Características
            const featureItems = document.querySelectorAll('[class*="featuresItem"]');
            featureItems.forEach(item => {
                const text = item.innerText.toLowerCase();
                if (text.includes('hab')) rooms = parseInt(text.replace(/[^0-9]/g, ''), 10) || rooms;
                if (text.includes('m²')) size = parseInt(text.replace(/[^0-9]/g, ''), 10) || size;
            });

            // Localización: Suele estar cerca del título o en breadcrumbs
            const locCandidate = document.querySelector('[class*="location"]') ||
                document.querySelector('.re-DetailHeader-featuresItem--location');
            location = locCandidate ? locCandidate.innerText.trim() : '';

            if (!location) {
                // Sacar de los breadcrumbs si no se encuentra
                const crumbs = Array.from(document.querySelectorAll('.re-Breadcrumb-item'));
                if (crumbs.length > 0) {
                    location = crumbs[crumbs.length - 1].innerText.trim();
                }
            }

            // Imagen
            const img = document.querySelector('.re-DetailSlider-slide img') ||
                document.querySelector('img[src*="static.fotocasa.es"]') ||
                document.querySelector('[class*="Multimedia"] img');
            image_url = img ? img.src : '';
        } else if (source === 'idealista') {
            title = document.querySelector('h1')?.innerText?.trim() || '';
            const priceEl = document.querySelector('.info-data .item-price') || document.querySelector('.info-data-price');
            price = priceEl ? parseInt(priceEl.innerText.replace(/[^0-9]/g, ''), 10) : 0;

            const detailItems = document.querySelectorAll('.main-info__details-item');
            detailItems.forEach(item => {
                const text = item.innerText.toLowerCase();
                if (text.includes('hab')) rooms = parseInt(text.replace(/[^0-9]/g, ''), 10) || rooms;
                if (text.includes('m²')) size = parseInt(text.replace(/[^0-9]/g, ''), 10) || size;
            });

            location = document.querySelector('.main-info__title-minor')?.innerText?.trim() || '';
            const img = document.querySelector('.main-image img') || document.querySelector('#main-image img');
            image_url = img ? img.src : '';
        }

        return { title, current_price: price, rooms, size_sqm: size, location, image_url };
    }, source);

    return {
        external_id,
        source,
        url,
        ...details,
        bathrooms: 1,
        is_favorite: true
    };
}

async function run() {
    const filePath = './interesantes.json';
    if (!fs.existsSync(filePath)) return;

    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`🚀 Procesando ${data.length} entradas...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        for (let i = 0; i < data.length; i++) {
            const entry = data[i];

            // Forzar actualización si no hay título o imagen (o forceUpdate)
            if (!entry.title || !entry.image_url || entry.forceUpdate) {
                console.log(`📦 Scraping: ${entry.url}`);
                try {
                    const scraped = await scrapeProperty(page, entry.url);
                    // Actualizar el objeto con los datos obtenidos
                    data[i] = { ...data[i], ...scraped };
                    delete data[i].forceUpdate;
                } catch (err) {
                    console.error(`❌ Error en scraping:`, err.message);
                }
            }

            // Sincronizar con Supabase
            const { is_favorite, ...supabaseData } = data[i];
            if (supabaseData.external_id) {
                console.log(`💾 Supabase: ${supabaseData.title || 'Sin Título'}`);

                const { data: existing } = await supabase
                    .from('properties')
                    .select('id, current_price')
                    .eq('external_id', supabaseData.external_id)
                    .single();

                if (!existing) {
                    const { data: inserted, error: iError } = await supabase
                        .from('properties')
                        .insert([{ ...supabaseData, status: 'active' }])
                        .select().single();

                    if (inserted) {
                        await supabase.from('price_history').insert([{ property_id: inserted.id, price: supabaseData.current_price }]);
                    }
                } else {
                    await supabase
                        .from('properties')
                        .update({ ...supabaseData, status: 'active', last_seen: new Date().toISOString() })
                        .eq('id', existing.id);

                    if (supabaseData.current_price !== existing.current_price) {
                        await supabase.from('price_history').insert([{ property_id: existing.id, price: supabaseData.current_price }]);
                    }
                }
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        console.log("🎉 Finalizado.");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await browser.close();
    }
}

run();
