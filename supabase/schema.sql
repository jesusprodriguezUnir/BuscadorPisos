-- Enum o Check para el estado de la propiedad

-- Tabla properties
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    source VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    current_price INTEGER NOT NULL,
    rooms INTEGER,
    bathrooms NUMERIC(3,1),
    size_sqm INTEGER,
    location VARCHAR(255),
    image_url TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla price_history
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    date_recorded TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices recomendados para consultas frecuentes
CREATE INDEX idx_properties_external_id ON properties(external_id);
CREATE INDEX idx_properties_status ON properties(status);
