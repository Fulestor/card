export default async function handler(req, res) {
    // Vercel автоматически подставит эти переменные
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
        return res.status(500).json({ error: 'База данных не подключена' });
    }

    // Если фронтенд запрашивает список лидеров
    if (req.method === 'GET') {
        try {
            // Достаем топ-10 игроков (команда ZREVRANGE)
            const response = await fetch(`${KV_URL}/ZREVRANGE/snake_leaderboard/0/9/WITHSCORES`, {
                headers: { Authorization: `Bearer ${KV_TOKEN}` }
            });
            const data = await response.json();
            
            const formatted = [];
            // Redis отдает массив в виде ["Имя1", "Очки1", "Имя2", "Очки2"], собираем его в объекты
            if (data.result) {
                for (let i = 0; i < data.result.length; i += 2) {
                    formatted.push({ 
                        name: data.result[i], 
                        score: parseInt(data.result[i + 1]) 
                    });
                }
            }
            return res.status(200).json(formatted);
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка чтения из БД' });
        }
    }

    // Если фронтенд отправляет новый рекорд
    if (req.method === 'POST') {
        try {
            const { name, score } = req.body;
            
            // Сохраняем результат. Если игрок с таким именем уже есть, рекорд обновится (команда ZADD)
            await fetch(`${KV_URL}/ZADD/snake_leaderboard/${score}/${encodeURIComponent(name)}`, {
                headers: { Authorization: `Bearer ${KV_TOKEN}` }
            });
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка записи в БД' });
        }
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
}