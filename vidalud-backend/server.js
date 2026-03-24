const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); // NUEVO: La herramienta para encriptar datos para Facebook

const app = express();
app.use(cors({
  origin: [
    'http://localhost:4200', 
    'https://vidalud-frontend.vercel.app',
    'https://vidalud.com',
    'https://www.vidalud.com'
  ]
}));
app.use(express.json());

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkmX4yzLaRd7r5Evj-Hu0nFdpnvN7a_x4whpm40cX1_fObvu5-IpNktn5r9l3cphk/exec';

// === CONFIGURACIÓN DE META (FACEBOOK) ===
const META_PIXEL_ID = '4032498167050111';
const META_ACCESS_TOKEN = 'EAAM5VvxvLBEBRNwly2gzyTesxoqikATZA6smEkkIeWNiVJ51f7yGT1kXP5oQDpd9cZBaIoxoZAVZBZAePa1aQNN8aAZBFqIBfr33SIi16PMXg7E8v3CKR4OHX49xbJudbpw6GbjEZBKpv9LqGOGiOpZChHAQBuly67fB3kgZBn2UHZBpvRIkXJXS9VXPfBoZBkS5PIQuAZDZD';

// Función obligatoria de Facebook para encriptar correos y teléfonos (SHA256)
const hashData = (data) => {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toString().trim().toLowerCase()).digest('hex');
};

app.post('/api/orders', async (req, res) => {
    try {
        const order = req.body;
        console.log('📦 Orden recibida:', JSON.stringify(order, null, 2));

        const payload = {
            firstName:  order.firstName  || '',
            lastName:   order.lastName   || '',
            phone:      order.phone      || '',
            email:      order.email      || '',
            department: order.department || '',
            city:       order.city       || '',
            address:    order.address    || '',
            notes:      order.notes      || '',
            productId:  order.productId  || '',
            quantity:   order.quantity   || 1,
            total:      order.total      || 0,
        };

        console.log('📤 Enviando a Google Script...');
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok || data.success === false) {
            console.error('❌ Google Script falló:', data);
            return res.status(500).json({ error: 'Error al guardar pedido', details: data });
        }

        console.log('✅ Pedido guardado en Excel. ID:', data.orderId);

        // === 🚀 NUEVO: ENVIAR COMPRA A FACEBOOK (CONVERSIONS API) ===
        try {
            // Facebook prefiere los números con código de país. Si no tiene el 57 de Colombia, se lo ponemos.
            let phoneFormatted = order.phone.toString().startsWith('57') ? order.phone : '57' + order.phone;

            const metaPayload = {
                data: [
                    {
                        event_name: 'Purchase', // Evento de Compra
                        event_time: Math.floor(Date.now() / 1000),
                        action_source: 'website',
                        user_data: {
                            em: [hashData(order.email)],
                            ph: [hashData(phoneFormatted)]
                        },
                        custom_data: {
                            currency: 'COP', // Moneda Colombiana
                            value: order.total || 0
                        }
                    }
                ],
                access_token: META_ACCESS_TOKEN
            };

            const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metaPayload)
            });
            
            const metaResult = await metaResponse.json();
            console.log('🔵 Respuesta de Facebook CAPI:', metaResult);
        } catch (metaError) {
            // Si Facebook falla, igual le decimos al cliente que su compra fue exitosa
            console.error('🟠 Error enviando venta a Facebook:', metaError.message);
        }
        // ============================================================

        res.status(200).json({ success: true, orderId: data.orderId });

    } catch (error) {
        console.error('🔥 Error interno:', error);
        res.status(500).json({ error: 'Falla de conexión en el Backend' });
    }
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend Vidalud corriendo en el puerto ${PORT}`));