import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'

// 分割したルートモジュールを読み込む
import masterRoutes from './routes/master'
import stockRoutes from './routes/stock'

const app = new Hono<AppEnv>()

// ==========================================
// ① セキュリティ・CORS設定
// ==========================================
app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
}))

// ==========================================
// ② テナントIDの固定（認証本格導入までは t-001 に固定）
// ==========================================
app.use('/api/*', async (c, next) => {
  // すべてのAPIリクエストに 't-001' をセットして、分割先のファイルに渡す
  c.set('tenantId', 't-001');
  await next();
});

// ==========================================
// ★ 画像アップロード＆取得 API (R2)
// ==========================================

// ① 画像アップロードの共通処理
const uploadHandler = async (c: any) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    
    if (!file || typeof file === 'string') {
      return c.json({ error: 'Invalid file' }, 400);
    }

    // スマホからファイル名が送られてこなかった場合の安全策
    const safeName = file.name || 'image.jpg';
    const ext = safeName.includes('.') ? safeName.split('.').pop() : 'jpg';
    const fileName = `${(globalThis as any).crypto.randomUUID()}.${ext}`;

    // バッファとして読み込み、空ファイルでないかチェック
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength === 0) {
      return c.json({ error: 'File is empty' }, 400);
    }

    // 画像の種類を明示的に指定
    const contentType = file.type || 'image/jpeg';

    await c.env.clinic_stock_images.put(fileName, buffer, {
      httpMetadata: { contentType: contentType }
    });

    return c.json({ imageUrl: `/api/images/${fileName}` }, 200);
  } catch (e: any) {
    console.error('R2 Error:', e);
    return c.json({ error: e.message || 'Unknown R2 Error' }, 500);
  }
};

// ② 画像取得の共通処理
const imageHandler = async (c: any) => {
  const key = c.req.param('key');
  const object = await c.env.clinic_stock_images.get(key);
  
  if (!object) return c.text('Not found', 404);
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  
  return new Response(object.body, { headers });
};

// ★ Viteプロキシが /api を削っても削らなくても動くように「両方」で待ち受けます！
app.post('/upload', uploadHandler);
app.post('/api/upload', uploadHandler);

app.get('/images/:key', imageHandler);
app.get('/api/images/:key', imageHandler);
// ==========================================
// ③ ルーティング（各ファイルへの振り分け）
// ==========================================
// "/api" にアクセスが来たら、それぞれのファイルに処理を丸投げする
app.route('/api', masterRoutes);
app.route('/api', stockRoutes);

export default app;