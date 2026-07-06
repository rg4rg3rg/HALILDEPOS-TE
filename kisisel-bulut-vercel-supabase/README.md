# Kişisel Bulut — Vercel + Supabase

Next.js App Router ile geliştirilmiş tek kullanıcılı kişisel dosya paneli.
Uygulama Vercel üzerinde çalışır; dosyalar Vercel diskine değil, kalıcı
Supabase Storage bucket'ına kaydedilir.

## Özellikler

- Yalnızca `.env.local` / Vercel Environment Variables ile tanımlanan admin girişi
- bcrypt parola doğrulaması
- HMAC-SHA256 imzalı, `HttpOnly`, `SameSite=Strict`, üretimde `Secure` oturum çerezi
- Özel Supabase Storage bucket'ında dosya listeleme
- Doğrudan Supabase'e imzalı URL ile yükleme ve ilerleme göstergesi
- 2 GB uygulama katmanı dosya sınırı
- Süresi 60 saniye olan özel indirme bağlantıları
- Dosya silme ve anlık arama
- Mobil uyumlu siyah tema
- Origin doğrulaması ve güvenlik başlıkları
- Service Role Key yalnızca sunucu tarafında kullanılır

## Proje yapısı

```text
app/
  api/
    files/
      download/route.js
      upload-url/route.js
      route.js
    login/route.js
    logout/route.js
  dashboard/page.js
  login/page.js
  error.js
  globals.css
  layout.js
  not-found.js
  page.js
components/
  DashboardClient.js
  LoginForm.js
lib/
  env.js
  files.js
  security.js
  session.js
  supabase.js
scripts/
  hash-password.mjs
.env.local.example
.gitignore
jsconfig.json
next.config.mjs
package.json
package-lock.json
vercel.json
```

## 1. Supabase kurulumu

1. [Supabase Dashboard](https://supabase.com/dashboard) üzerinden ücretsiz bir
   proje oluşturun.
2. **Storage → New bucket** bölümünden `personal-files` adlı bir bucket
   oluşturun.
3. Bucket'ı **Private** bırakın. Public bucket kullanmayın.
4. **Project Settings → API Keys** bölümünden şunları alın:
   - Project URL
   - Service Role Key / secret service key
5. Service Role Key'i hiçbir zaman istemci koduna, GitHub'a veya
   `NEXT_PUBLIC_` ile başlayan bir değişkene koymayın. Bu anahtar RLS
   kontrollerini aşabildiği için yalnızca Vercel'in sunucu ortamında tutulur.

Uygulama bütün Storage işlemlerini doğrulanmış admin oturumu arkasındaki
sunucu rotalarından başlatır. Bucket için public RLS politikası eklemek gerekmez.

## 2. Lokal kurulum

Node.js 20.9 veya daha yeni gereklidir.

```bash
npm install
```

Örnek ortam dosyasını kopyalayın:

```powershell
# Windows PowerShell
Copy-Item .env.local.example .env.local
```

```bash
# macOS / Linux
cp .env.local.example .env.local
```

Parola özeti üretin:

```bash
npm run hash-password -- "en-az-12-karakterlik-guclu-sifre"
```

Session secret üretin:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`.env.local` dosyasını doldurun:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt çıktısı>
SESSION_SECRET=<en az 32 karakterlik rastgele değer>
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_KODUNUZ.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_BUCKET=personal-files
```

Çalıştırın:

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın.

## 3. GitHub'a yükleme

Yeni ve tercihen private bir GitHub reposu oluşturun:

```bash
git init
git add .
git commit -m "Vercel Supabase kişisel bulut"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

`.env.local`, `.next`, `.vercel` ve `node_modules` `.gitignore` kapsamındadır.
Secret değerlerini GitHub'a göndermeyin.

## 4. Vercel'e yükleme

1. [Vercel Dashboard](https://vercel.com/new) üzerinden **Add New → Project**
   seçin.
2. GitHub reposunu içe aktarın.
3. Framework Preset olarak **Next.js** otomatik algılanır.
4. Build Command alanına şunu yazın:

   ```text
   npm install && npm run build
   ```

5. Output Directory ve Start Command alanlarını değiştirmeyin:

   ```text
   Start/Output: Next.js default
   ```

6. **Environment Variables** bölümüne aşağıdaki altı değişkeni ekleyin:

   ```text
   ADMIN_USERNAME
   ADMIN_PASSWORD_HASH
   SESSION_SECRET
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_BUCKET
   ```

7. Değişkenleri en az **Production** ortamına uygulayın. Preview deploy'larını
   kullanacaksanız Preview ortamına da ekleyin.
8. **Deploy** düğmesine basın.

Repo kökündeki `vercel.json`, Build Command değerini de içerir. Vercel Next.js
çıktısını otomatik yönettiği için özel Output Directory veya Start Command
gerekmez.

## Environment Variables

| Değişken | Örnek / açıklama |
| --- | --- |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD_HASH` | `npm run hash-password` çıktısı |
| `SESSION_SECRET` | En az 32 karakterlik rastgele değer |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret Service Role Key |
| `SUPABASE_BUCKET` | `personal-files` |

`SUPABASE_SERVICE_ROLE_KEY` kesinlikle `NEXT_PUBLIC_` öneki almamalıdır.

## Dosya yükleme mimarisi

1. Admin uygulamadan kısa ömürlü bir imzalı yükleme URL'si ister.
2. Next.js sunucu rotası oturumu doğrular ve Service Role Key ile Supabase
   imzalı URL oluşturur.
3. Tarayıcı dosyayı doğrudan Supabase Storage'a yükler.
4. Service Role Key hiçbir zaman tarayıcıya gönderilmez.

Bu yapı, dosya verisini Vercel Function üzerinden geçirmediği için Vercel'in
geçici dosya sistemine ihtiyaç duymaz.

## Boyut ve ücretsiz plan notu

Uygulama 2 GB'a kadar dosya seçimine izin verir. Supabase projenizdeki global
ve bucket dosya boyutu limiti daha düşükse Supabase yüklemeyi reddeder.
Supabase Dashboard içindeki **Storage Settings** bölümünden geçerli limiti
kontrol edin. Büyük dosyalarda Supabase resumable/TUS yükleme yöntemi daha
dayanıklıdır; bu sürüm standart imzalı yükleme kullanır.

## Komutlar

```bash
npm run dev
npm run build
npm start
npm run hash-password -- "guclu-sifre"
npm run check
```
