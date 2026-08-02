export default async function handler(req, res) {
    // Проверяем всевозможные варианты названий переменных, которые может передать Vercel
    const KV_URL = process.env.KV_REST_API_URL || process.env.KV_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.KV_PASSWORD;

    if (!KV_URL || !KV_TOKEN) {
        return res.status(500).json({ 
            error: 'База данных не подключена', 
            debug: { hasUrl: !!KV_URL, hasToken: !!KV_TOKEN } 
        });
    }

    if (req.method === 'GET') {
        try {
            const response = await fetch(KV_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${KV_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(["ZREVRANGE", "snake_leaderboard", 0, 9, "WITHSCORES"])
            });
            const data = await response.json();
            
            const formatted = [];
            if (data.result && Array.isArray(data.result)) {
                for (let i = 0; i < data.result.length; i += 2) {
                    formatted.push({ 
                        name: data.result[i], 
                        score: parseInt(data.result[i + 1]) 
                    });
                }
            }
            return res.status(200).json(formatted);
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка чтения из БД', details: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { name, score } = req.body;
            
            await fetch(KV_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${KV_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(["ZADD", "snake_leaderboard", score, name])
            });
            
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка записи в БД', details: error.message });
        }
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
}
