const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkmX4yzLaRd7r5Evj-Hu0nFdpnvN7a_x4whpm40cX1_fObvu5-IpNktn5r9l3cphk/exec';

app.post('/api/orders', async (req, res) => {
    try {
        const order = req.body;
        console.log('📦 Orden recibida:', JSON.stringify(order, null, 2));

        // Construimos el payload EXPLÍCITAMENTE con cada campo nombrado
        const payload = {
            firstName:  order.firstName  || '',
            lastName:   order.lastName   || '',
            phone:      order.phone      || '',
            email:      order.email      || '',
            department: order.department || '',
            city:       order.city       || '',
            address:    order.address    || '',   // ya viene "CRA 17, Barrio X"
            notes:      order.notes      || '',
            productId:  order.productId  || '',
            quantity:   order.quantity   || 1,
            total:      order.total      || 0,
        };

        console.log('📤 Enviando a Google Script:', JSON.stringify(payload, null, 2));

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const text = await response.text();
        console.log('📥 Respuesta Google:', text);

        let data;
        try { data = JSON.parse(text); }
        catch { data = { raw: text }; }

        if (!response.ok || data.success === false) {
            console.error('❌ Google Script falló:', data);
            return res.status(500).json({ error: 'Error al guardar pedido', details: data });
        }

        console.log('✅ Pedido guardado. ID:', data.orderId);
        res.status(200).json({ success: true, orderId: data.orderId });

    } catch (error) {
        console.error('🔥 Error interno:', error);
        res.status(500).json({ error: 'Falla de conexión en el Backend' });
    }
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Backend Vidalud corriendo en http://localhost:${PORT}`));